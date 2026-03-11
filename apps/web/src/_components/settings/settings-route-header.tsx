import { useLocation } from "@tanstack/react-router";

type SettingsHeaderData = {
  title: string;
  description: string;
};

const SETTINGS_HEADERS: Array<{ prefix: string; data: SettingsHeaderData }> = [
  {
    prefix: "/settings/account",
    data: {
      title: "Account",
      description: "Manage your account details and preferences.",
    },
  },
  {
    prefix: "/settings/threads",
    data: {
      title: "Threads",
      description: "Search, sort, and manage your threads.",
    },
  },
  {
    prefix: "/settings/customization",
    data: {
      title: "Customization",
      description: "Personalize how the assistant talks to you and how the UI behaves.",
    },
  },
  {
    prefix: "/settings/statistics",
    data: {
      title: "Statistics",
      description:
        "View your chat statistics and activity. Counts are tracked in tokens (not words).",
    },
  },
  {
    prefix: "/settings/attachments",
    data: {
      title: "Attachments",
      description: "View and manage your attachments.",
    },
  },
  {
    prefix: "/settings/models",
    data: {
      title: "Models",
      description: "Choose which models are visible in the model picker.",
    },
  },
  {
    prefix: "/settings/profiles",
    data: {
      title: "AI Profiles",
      description: "Create reusable AI personas for your chats.",
    },
  },
];

function getHeaderForPathname(pathname: string): SettingsHeaderData | null {
  for (const item of SETTINGS_HEADERS) {
    if (pathname.startsWith(item.prefix)) return item.data;
  }

  return null;
}

export function SettingsRouteHeader() {
  const { pathname } = useLocation();
  const header = getHeaderForPathname(pathname);

  if (!header) return null;

  return (
    <div className="sticky top-0 z-20 flex w-full flex-col gap-1 bg-background px-0.5 py-2">
      <h2 className="text-2xl font-bold">{header.title}</h2>
      <p className="text-muted-foreground">{header.description}</p>
    </div>
  );
}
