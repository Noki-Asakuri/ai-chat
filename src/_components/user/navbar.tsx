import { Link, useLocation } from "@tanstack/react-router";
import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  PaperclipIcon,
  UserRoundPenIcon,
} from "lucide-react";

import { Tab, Tabs, TabsList } from "@/components/ui/tabs";

const paths = [
  {
    name: "Account",
    path: "/settings/account",
    icon: CircleUserRoundIcon,
  },
  {
    name: "Customization",
    path: "/settings/customization",
    icon: Columns3CogIcon,
  },
  {
    name: "Statistics",
    path: "/settings/statistics",
    icon: ChartNoAxesColumnIcon,
  },
  {
    name: "Attachments",
    path: "/settings/attachments",
    icon: PaperclipIcon,
  },
  {
    name: "Models",
    path: "/settings/models",
    icon: BrainIcon,
  },
  {
    name: "Profiles",
    path: "/settings/profiles",
    icon: UserRoundPenIcon,
  },
];

export function UserNavbar() {
  const { pathname, search } = useLocation();
  const activeTab = paths.find((p) => pathname.startsWith(p.path));

  return (
    <Tabs
      className="z-20 rounded-md border bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60"
      value={activeTab ? "tab-" + activeTab.name : null}
    >
      <TabsList>
        {paths.map(({ path, name, icon: Icon }) => (
          <Tab key={path} value={"tab-" + name} className="h-10 px-0 py-1">
            <Link
              to={path}
              search={search}
              className="flex size-full items-center justify-center gap-1.5 rounded-md px-2 transition-colors hover:bg-muted-foreground/20 active:hover:bg-transparent"
            >
              <Icon className="size-5" />
              <span>{name}</span>
            </Link>
          </Tab>
        ))}
      </TabsList>
    </Tabs>
  );
}
