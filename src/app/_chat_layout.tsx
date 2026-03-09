import "streamdown/styles.css";

import { api } from "@/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { getSignInUrl } from "@/lib/authkit/serverFunctions";
import {
  CHAT_APPEARANCE_COOKIE_NAME,
  LEGACY_BACKGROUND_IMAGE_COOKIE_NAME,
  LEGACY_DISABLE_BLUR_COOKIE_NAME,
  readChatAppearanceFromCookieValues,
  writeChatAppearanceCookie,
  type ChatAppearance,
} from "@/lib/chat/appearance-cookie";
import { convexSessionQuery } from "@/lib/convex/helpers";

type ChatPreferences = {
  backgroundId?: string | null;
  performanceEnabled?: boolean;
};

type ChatLayoutCookies = ChatAppearance & {
  defaultOpenSidebar: boolean;
};

function getBackgroundImageUrl(backgroundId: string): string {
  return buildImageAssetUrl(backgroundId);
}

function resolveBackgroundImage(
  backgroundId: string | null | undefined,
  fallbackBackgroundImage: string | undefined,
): string | undefined {
  if (backgroundId === null) {
    return undefined;
  }

  if (backgroundId) {
    return getBackgroundImageUrl(backgroundId);
  }

  return fallbackBackgroundImage;
}

function resolveAppearanceFromCustomization(
  customization: ChatPreferences,
  fallbackAppearance: ChatAppearance,
): ChatAppearance {
  return {
    backgroundImage: resolveBackgroundImage(
      customization.backgroundId,
      fallbackAppearance.backgroundImage,
    ),
    performanceEnabled: customization.performanceEnabled ?? fallbackAppearance.performanceEnabled,
  };
}

function toChatLayoutCookies(values: {
  chatAppearance: string | undefined;
  backgroundImage: string | undefined;
  performanceEnabled: string | undefined;
  defaultOpenSidebar: string | undefined;
}): ChatLayoutCookies {
  const appearance = readChatAppearanceFromCookieValues({
    chatAppearance: values.chatAppearance,
    backgroundImage: values.backgroundImage,
    performanceEnabled: values.performanceEnabled,
  });

  return {
    ...appearance,
    defaultOpenSidebar: values.defaultOpenSidebar === "true",
  };
}

const getChatLayoutCookies = createIsomorphicFn()
  .server(async () => {
    return toChatLayoutCookies({
      chatAppearance: getCookie(CHAT_APPEARANCE_COOKIE_NAME),
      backgroundImage: getCookie(LEGACY_BACKGROUND_IMAGE_COOKIE_NAME),
      performanceEnabled: getCookie(LEGACY_DISABLE_BLUR_COOKIE_NAME),
      defaultOpenSidebar: getCookie(SIDEBAR_COOKIE_NAME),
    });
  })
  .client(async () => {
    return toChatLayoutCookies({
      chatAppearance: (await cookieStore.get(CHAT_APPEARANCE_COOKIE_NAME))?.value,
      backgroundImage: (await cookieStore.get(LEGACY_BACKGROUND_IMAGE_COOKIE_NAME))?.value,
      performanceEnabled: (await cookieStore.get(LEGACY_DISABLE_BLUR_COOKIE_NAME))?.value,
      defaultOpenSidebar: (await cookieStore.get(SIDEBAR_COOKIE_NAME))?.value,
    });
  });

export const Route = createFileRoute("/_chat_layout")({
  component: RouteComponent,

  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }
  },

  loader: async ({ context }) => {
    const cookiesDefaultOptions = await getChatLayoutCookies();
    return { ...cookiesDefaultOptions, user: context.user! };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { backgroundImage, defaultOpenSidebar, performanceEnabled } = Route.useLoaderData();
  const [appearance, setAppearance] = useState<ChatAppearance>(() => ({
    backgroundImage,
    performanceEnabled,
  }));

  const handleCustomizationChange = useCallback((customization: ChatPreferences) => {
    setAppearance((currentAppearance) => {
      const nextAppearance = resolveAppearanceFromCustomization(customization, currentAppearance);
      writeChatAppearanceCookie(nextAppearance);
      return nextAppearance;
    });
  }, []);

  return (
    <SidebarProvider
      id="sidebar-provider"
      data-performance-mode={appearance.performanceEnabled ? "true" : "false"}
      style={{
        backgroundImage: appearance.backgroundImage
          ? `url(${appearance.backgroundImage})`
          : undefined,
      }}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      defaultOpen={defaultOpenSidebar}
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

        <ChatComponentPage onCustomizationChange={handleCustomizationChange} />
      </GlobalDropzone>

      <RegisterEventHandlers />
    </SidebarProvider>
  );
}

type ChatComponentPageProps = {
  onCustomizationChange: (customization: ChatPreferences) => void;
};

function ChatComponentPage({ onCustomizationChange }: ChatComponentPageProps) {
  const { data: preferences } = useQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );

  useEffect(() => {
    if (!preferences) return;

    onCustomizationChange({
      backgroundId: preferences.backgroundImage,
      performanceEnabled: preferences.performanceEnabled,
    });
  }, [preferences, onCustomizationChange]);

  return (
    <ConfigStoreProvider
      initialState={{
        hiddenModels: preferences?.models?.hidden ?? [],
        favoriteModels: preferences?.models?.favorite ?? [],
        defaultShowFullCode: preferences?.code?.showFullCode,
      }}
    >
      <Outlet />
      <ThreadProfileSidebar />
    </ConfigStoreProvider>
  );
}
