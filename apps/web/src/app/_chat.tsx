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

    const promises: Promise<unknown>[] = [];

    promises.push(
      context.queryClient.ensureQueryData(convexQuery(api.functions.users.getCurrentUserPreferences)),
    );

    promises.push(context.queryClient.ensureQueryData(convexQuery(api.functions.users.currentUser)));

    await Promise.all(promises);
    return { user: auth.user, defaultOpenSidebar };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { defaultOpenSidebar } = Route.useLoaderData();
  const { data: userPreferencesData } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );
  const backgroundStyle = {
    backgroundImage: userPreferencesData.backgroundImage
      ? `url(${buildImageAssetUrl(userPreferencesData.backgroundImage)})`
      : undefined,
  };

  return (
    <SidebarProvider
      id="sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      data-performance-mode={userPreferencesData.performanceEnabled ? "true" : "false"}
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
  const { data: defaultUserPreferences } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );

  const { data: userPreferences } = useQuery({
    ...convexSessionQuery(api.functions.users.getCurrentUserPreferences, { threadId }),
    initialData: defaultUserPreferences,
  });

  return (
    <ConfigStoreProvider
      key={threadId ?? "welcome"}
      initialState={{
        hiddenModels: userPreferences.models.hidden,
        favoriteModels: userPreferences.models.favorite,

        pref: userPreferences.sendPreference,
        notificationSound: userPreferences.notifications.sound,
        desktopNotification: userPreferences.notifications.desktop,

        wrapline: userPreferences.code.autoWrap,
        showFullCode: userPreferences.code.showFullCode,

        model: userPreferences.models.selectedModel,
        defaultModel: userPreferences.models.selectedModel,
        modelParams: userPreferences.models.selectedModelParams,
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
