import { Link, useLocation } from "@tanstack/react-router";
import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  UserRoundPenIcon,
} from "lucide-react";

import { Tabs, TabsList, TabTrigger } from "@/components/ui/tabs";

import { getNavigationViewTransition } from "@/lib/navigation/view-transitions";

const paths = [
  {
    name: "Account",
    path: "/settings/account",
    icon: CircleUserRoundIcon,
  },
  {
    name: "Threads",
    path: "/settings/threads",
    icon: MessagesSquareIcon,
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
      <TabsList className="w-full py-1">
        {paths.map(({ path, name, icon: Icon }) => {
          const renderProp = (
            <Link
              to={path}
              search={search}
              viewTransition={getNavigationViewTransition(pathname, path)}
            />
          );

          return (
            <TabTrigger
              key={path}
              nativeButton={false}
              value={"tab-" + name}
              render={renderProp}
              className="h-8 gap-1.5 rounded-md transition-colors aria-[selected='false']:hover:bg-muted-foreground/20"
            >
              <Icon className="size-5" />
              <span>{name}</span>
            </TabTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
