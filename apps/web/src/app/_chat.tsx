import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useParams } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { convexQuery } from "@convex-dev/react-query";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { Suspense, useEffect } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

import { normalizeAppearance } from "@/lib/appearance/theme";
import { buildImageAssetUrl } from "@/lib/assets/urls";
import { resolveReasoning, tryGetModelData } from "@/lib/chat/models";
import { getNewChatInitialProfile, type InitialChatProfile } from "@/lib/profiles/chat-profile";
import {
  getGroupDefaultProfileId,
  profileLibraryQuery,
  type ProfileLibrary,
} from "@/lib/profiles/profile-library";
import { NewChatProfileDefault, ThreadProfileDefault } from "@/components/profiles/new-chat-profile-default";
import type { ConfigServerState } from "@/lib/store/config-store";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import { cn, fromUUID } from "@/lib/utils";

const getDefaultOpenSidebar = createIsomorphicFn()
  .server(async function () {
    const defaultOpenSidebar = getCookie(SIDEBAR_COOKIE_NAME) === "true";

    return { defaultOpenSidebar };
  })
  .client(async function () {
    const defaultOpenSidebar = await cookieStore.get(SIDEBAR_COOKIE_NAME);

    return { defaultOpenSidebar: defaultOpenSidebar?.value === "true" };
  });

export const Route = createFileRoute("/_chat")({
  component: RouteComponent,

  beforeLoad: async ({ location }) => {
    const auth = await getAuth();
    if (!auth.user) {
      throw redirect({ to: "/auth/login", search: { rt: location.href }, reloadDocument: true });
    }
    return { user: auth.user };
  },
  loader: async ({ context }) => {
    const [{ defaultOpenSidebar }] = await Promise.all([
      getDefaultOpenSidebar(),
      context.queryClient.query(convexQuery(api.functions.users.getChatShell)),
      // So the chat store starts with the group's profile instead of switching to it a frame later.
      // The picker only hides without it, and sending loads it again, so a failure is not fatal.
      context.queryClient.query(profileLibraryQuery).catch(() => null),
    ]);
    return { user: context.user, defaultOpenSidebar };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { defaultOpenSidebar } = Route.useLoaderData();
  const { data: chatShell } = useSuspenseQuery(convexQuery(api.functions.users.getChatShell));

  const appearance = normalizeAppearance(chatShell.preferences.appearance);
  const backgroundImage = chatShell.preferences.backgroundImage;

  return (
    <SidebarProvider
      id="sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      data-performance-mode={chatShell.preferences.performanceEnabled ? "true" : "false"}
      data-has-background={backgroundImage ? "true" : "false"}
      data-blur-mode={backgroundImage ? appearance.blurMode : undefined}
      className="group/sidebar-provider isolate bg-sidebar font-sans"
    >
      {backgroundImage && (
        <ChatBackdrop
          src={buildImageAssetUrl(backgroundImage)}
          blur={appearance.blurMode === "backdrop" ? appearance.backdropBlur : 0}
        />
      )}
      <SidebarTrigger size="icon-lg" className="fixed top-1.5 left-3.5 z-60 [&_svg]:size-5!" />
      <ThreadSidebar />

      <ChatLayoutConfig />
    </SidebarProvider>
  );
}

function ChatBackdrop({ src, blur }: { src: string; blur: number }) {
  return (
    <div
      aria-hidden
      data-slot="chat-backdrop"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${JSON.stringify(src)})`,
          // Scale past the edges so the blur doesn't fade them to the page color.
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          transform: blur > 0 ? `scale(${1 + Math.min(blur, 64) / 200})` : undefined,
        }}
      />
    </div>
  );
}

function ChatLayoutConfig() {
  const { isMobile, state: sidebarState } = useSidebar();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data: chatShell } = useSuspenseQuery(convexQuery(api.functions.users.getChatShell));
  const { data: threadMeta } = useQuery(
    convexQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  );
  const newChatKey = useThreadStore((state) => state.newChatKey);
  const queryClient = useQueryClient();

  // Opening a thread ends a hand pick on the new chat; coming back starts from the group's default.
  useEffect(() => {
    if (threadId) threadStoreActions.forgetNewChatProfile();
  }, [threadId]);

  // Read from the cache once, when the store is made, rather than subscribing: library updates
  // must never re-apply this layout's other settings (ChatProfileDefault follows them instead).
  function getInitialProfile(): InitialChatProfile | undefined {
    const library = queryClient.getQueryData<ProfileLibrary>(profileLibraryQuery.queryKey);
    if (!threadId) {
      const state = useThreadStore.getState();
      return getNewChatInitialProfile({
        library,
        groupId: state.activeGroupId,
        newChatKey: state.newChatKey,
        remembered: state.newChatProfile,
      });
    }
    if (!library || !threadMeta || threadMeta.latestModelParams.profile !== undefined) return undefined;
    return { profile: getGroupDefaultProfileId(library, threadMeta.groupId), chosen: false };
  }

  const selectedModel = threadMeta?.latestModel ?? chatShell.preferences.models.defaultModel;
  const storedModelParams = threadMeta?.latestModelParams ?? chatShell.preferences.models.modelParams;
  const selectedModelData = tryGetModelData(selectedModel);
  const selectedModelParams: NonNullable<ConfigServerState["modelParams"]> = {
    webSearch: storedModelParams.webSearch,
    effort: selectedModelData
      ? resolveReasoning(selectedModelData, storedModelParams.effort)
      : storedModelParams.effort,
  };
  // A thread's saved profile (including none) comes from the server like its other settings.
  // Otherwise the profile is left out, so a refresh can't undo a hand-picked one, and
  // NewChatProfileDefault or ThreadProfileDefault fills in the group's default.
  const threadProfileId = threadMeta?.latestModelParams.profile;
  if (threadId && threadProfileId !== undefined) selectedModelParams.profile = threadProfileId;

  return (
    <ConfigStoreProvider
      key={threadId ?? `welcome-${newChatKey}`}
      getInitialProfile={getInitialProfile}
      initialState={{
        hiddenModels: chatShell.preferences.models.hidden,
        favoriteModels: chatShell.preferences.models.favorite,

        pref: chatShell.preferences.sendPreference,
        notificationSound: chatShell.preferences.notifications.sound,
        desktopNotification: chatShell.preferences.notifications.desktop,

        wrapline: chatShell.preferences.code.autoWrap,
        showFullCode: chatShell.preferences.code.showFullCode,

        model: selectedModel,
        defaultModel: selectedModel,
        modelParams: selectedModelParams,
      }}
    >
      <GlobalDropzone data-slot="chat" className="relative inset-0 h-dvh w-screen overflow-hidden border-x">
        <div
          className={cn(
            "absolute top-0 z-10 flex h-12 w-full max-w-full items-center border-b bg-background/80 px-4 text-base backdrop-blur-md backdrop-saturate-150 transition-[padding] duration-200 ease-linear group-data-[performance-mode=true]/sidebar-provider:bg-background motion-reduce:transition-none",
            (isMobile || sidebarState === "collapsed") && "pl-16",
          )}
        >
          <ThreadTitle />
        </div>

        <div className="min-h-0 min-w-0 flex-1 bg-background">
          <Suspense>
            <Outlet />
          </Suspense>
        </div>

        <ChatTextarea key="main-chat-textarea" />
        {!threadId && <NewChatProfileDefault />}
        {threadId && threadMeta && threadProfileId === undefined && (
          <ThreadProfileDefault groupId={threadMeta.groupId} />
        )}
      </GlobalDropzone>

      <RegisterEventHandlers />
    </ConfigStoreProvider>
  );
}
