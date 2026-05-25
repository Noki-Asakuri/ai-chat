import "streamdown/styles.css";

import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useParams } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { convexQuery } from "@convex-dev/react-query";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { PlusIcon } from "lucide-react";
import { Suspense, type CSSProperties } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

const DEFAULT_UI_FONT = "Space Grotesk";
const DEFAULT_CODE_FONT = "JetBrains Mono";

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
      throw redirect({ to: "/auth/login", search: { rt: path } });
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
  const customStyle = getCustomizationStyle(userPreferencesData.fonts, userPreferencesData.backgroundImage);

  return (
    <SidebarProvider
      id="sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      data-performance-mode={userPreferencesData.performanceEnabled ? "true" : "false"}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat font-sans"
      style={customStyle}
    >
      <ThreadSidebar />

      <GlobalDropzone data-slot="chat" className="relative inset-0 h-dvh w-screen overflow-hidden border-x">
        <div className="absolute top-0 z-10 flex h-10 w-full max-w-full items-center gap-2 border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[performance-mode=true]/sidebar-provider:bg-sidebar">
          <SidebarTrigger />

          <Link to="/" className="rounded-md p-1.5 text-center transition-colors hover:bg-primary/20">
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

function getCustomizationStyle(
  fonts: { ui: string; code: string },
  backgroundImage: string | null,
): CSSProperties & {
  "--custom-ui-font": string;
  "--custom-code-font": string;
} {
  return {
    "--custom-ui-font": fonts.ui || DEFAULT_UI_FONT,
    "--custom-code-font": fonts.code || DEFAULT_CODE_FONT,
    backgroundImage: backgroundImage ? `url(${buildImageAssetUrl(backgroundImage)})` : undefined,
  };
}

function ChatLayoutConfig() {
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
      <div className="min-h-0 min-w-0 flex-1 bg-background">
        <Suspense>
          <Outlet />
        </Suspense>
      </div>

      <ChatTextarea key="main-chat-textarea" />

      <ThreadProfileSidebar />
    </ConfigStoreProvider>
  );
}
