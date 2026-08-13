import type { LucideIcon } from "lucide-react";
import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  PaletteIcon,
  UserRoundPenIcon,
} from "lucide-react";

import type { SETTINGS_ROUTE_ORDER } from "@/lib/navigation/view-transitions";

type SettingsPath = (typeof SETTINGS_ROUTE_ORDER)[number];

type SettingsNavigationItem = {
  path: SettingsPath;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const SETTINGS_NAVIGATION = [
  {
    path: "/settings/account",
    label: "Account",
    description: "Manage your account details and preferences.",
    icon: CircleUserRoundIcon,
  },
  {
    path: "/settings/threads",
    label: "Threads",
    description: "Search, sort, and manage your threads.",
    icon: MessagesSquareIcon,
  },
  {
    path: "/settings/customization",
    label: "Customization",
    description: "Personalize how the assistant talks to you.",
    icon: Columns3CogIcon,
  },
  {
    path: "/settings/appearance",
    label: "Appearance",
    description: "Choose how the interface looks and behaves.",
    icon: PaletteIcon,
  },
  {
    path: "/settings/statistics",
    label: "Statistics",
    description: "View your chat activity, request usage, and token totals.",
    icon: ChartNoAxesColumnIcon,
  },
  {
    path: "/settings/attachments",
    label: "Attachments",
    description: "View and manage your attachments.",
    icon: PaperclipIcon,
  },
  {
    path: "/settings/models",
    label: "Models",
    description: "Choose which models are visible in the model picker.",
    icon: BrainIcon,
  },
  {
    path: "/settings/profiles",
    label: "AI Profiles",
    description: "Create reusable AI personas for your chats.",
    icon: UserRoundPenIcon,
  },
] satisfies Array<SettingsNavigationItem>;

export function getSettingsNavigationItem(pathname: string): SettingsNavigationItem | null {
  for (const item of SETTINGS_NAVIGATION) {
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) return item;
  }

  return null;
}
