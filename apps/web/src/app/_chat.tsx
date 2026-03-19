import "streamdown/styles.css";

import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import type { UserPreferences } from "@ai-chat/backend/convex/functions/users";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useParams } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { convexQuery } from "@convex-dev/react-query";
import { PlusIcon } from "lucide-react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { getSignInUrl } from "@/lib/authkit/serverFunctions";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

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

  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }

    return { user: context.user };
  },

  loader: async ({ context, params: rawParams }) => {
    const { defaultOpenSidebar } = await getDefaultOpenSidebar();

    const params = rawParams as { threadId?: string };
    const threadId = fromUUID<Id<"threads">>(params.threadId);

    const promises: Promise<unknown>[] = [];

    promises.push(
      context.queryClient.ensureQueryData(
        convexQuery(api.functions.users.getCurrentUserPreferences, {
          sessionId: context.sessionId,
          threadId,
        }),
      ),
    );

    promises.push(
      context.queryClient.ensureQueryData(
        convexQuery(api.functions.users.currentUser, {
          sessionId: context.sessionId,
        }),
      ),
    );

    if (threadId) {
      promises.push(
        context.queryClient.ensureQueryData(
          convexQuery(api.functions.users.getCurrentUserPreferences, {
            sessionId: context.sessionId,
          }),
        ),
      );
    }

    const [userPreferencesData] = (await Promise.all(promises)) as [UserPreferences];
    return { user: context.user, defaultOpenSidebar, userPreferencesData };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { defaultOpenSidebar, userPreferencesData } = Route.useLoaderData();

  return (
    <SidebarProvider
      id="sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      data-performance-mode={userPreferencesData.performanceEnabled ? "true" : "false"}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      style={{
        backgroundImage: userPreferencesData.backgroundImage
          ? `url(${buildImageAssetUrl(userPreferencesData.backgroundImage)})`
          : undefined,
      }}
    >
      <ThreadSidebar />

      <GlobalDropzone
        data-slot="chat"
        className="relative inset-0 h-dvh w-screen overflow-hidden border-x"
      >
        <div className="absolute top-0 z-10 flex h-10 w-full max-w-full items-center gap-2 border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[performance-mode=true]/sidebar-provider:bg-sidebar">
          <SidebarTrigger />

          <Link
            to="/"
            className="rounded-md p-1.5 text-center transition-colors hover:bg-primary/20"
          >
            <PlusIcon className="size-4" />
            <span className="sr-only">Create new thread</span>
          </Link>

          <ThreadTitle />
        </div>

        <ChatLayoutConfig />
      </GlobalDropzone>

      <RegisterEventHandlers />
    </SidebarProvider>
  );
}

function ChatLayoutConfig() {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data: userPreferences } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences, { threadId }),
  );

  return (
    <ConfigStoreProvider
      key={threadId ?? "welcome"}
      initialState={{
        hiddenModels: userPreferences.models.hidden,
        favoriteModels: userPreferences.models.favorite,

        pref: userPreferences.sendPreference,
        notificationSound: userPreferences.notifications?.sound ?? true,
        desktopNotification: userPreferences.notifications?.desktop ?? false,
        wrapline: userPreferences.code.autoWrap,
        showFullCode: userPreferences.code.showFullCode,

        defaultModel: userPreferences.models.selectedModel,

        effort: userPreferences.models.selectedModelParams.effort,
        webSearch: userPreferences.models.selectedModelParams.webSearch,
        profile: userPreferences.models.selectedModelParams.profile,
        model: userPreferences.models.selectedModel,
      }}
    >
      <Outlet />

      <ChatTextarea key="main-chat-textarea" />

      <ThreadProfileSidebar />
    </ConfigStoreProvider>
  );
}
