import "streamdown/styles.css";

import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useParams } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { convexQuery } from "@convex-dev/react-query";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { Suspense } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { convexSessionQuery } from "@/lib/convex/helpers";
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

  loader: async function ({ context, location }) {
    const [auth, { defaultOpenSidebar }] = await Promise.all([getAuth(), getDefaultOpenSidebar()]);
    if (!auth.user) {
      const path = location.pathname;
      console.debug("[Chat] No user found, redirect to login");

      throw redirect({ to: "/auth/login", search: { rt: path }, reloadDocument: true });
    }

    await context.queryClient.ensureQueryData(convexQuery(api.functions.users.getChatShell));
    return { user: auth.user, defaultOpenSidebar };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { defaultOpenSidebar } = Route.useLoaderData();
  const { data: chatShell } = useSuspenseQuery(convexSessionQuery(api.functions.users.getChatShell));

  const backgroundStyle = {
    backgroundImage: chatShell.preferences.backgroundImage
      ? `url(${buildImageAssetUrl(chatShell.preferences.backgroundImage)})`
      : undefined,
  };

  return (
    <SidebarProvider
      id="sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      data-performance-mode={chatShell.preferences.performanceEnabled ? "true" : "false"}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat font-sans"
      style={backgroundStyle}
    >
      <SidebarTrigger size="icon-lg" className="fixed top-1.5 left-3.5 z-60 [&_svg]:size-5!" />
      <ThreadSidebar />

      <ChatLayoutConfig />
    </SidebarProvider>
  );
}

function ChatLayoutConfig() {
  const { isMobile, state: sidebarState } = useSidebar();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data: chatShell } = useSuspenseQuery(convexSessionQuery(api.functions.users.getChatShell));
  const { data: threadMeta } = useQuery(
    convexSessionQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  );

  const selectedModel = threadMeta?.latestModel ?? chatShell.preferences.models.defaultModel;
  const selectedModelParams = {
    ...(threadMeta?.latestModelParams ?? chatShell.preferences.models.modelParams),
    profile:
      threadMeta?.latestModelParams.profile ?? chatShell.preferences.models.modelParams.profile ?? null,
  };

  return (
    <ConfigStoreProvider
      key={threadId ?? "welcome"}
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
        <ThreadProfileSidebar />
      </GlobalDropzone>

      <RegisterEventHandlers />
    </ConfigStoreProvider>
  );
}
