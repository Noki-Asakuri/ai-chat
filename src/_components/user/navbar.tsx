import { Link, useSearch, useLocation } from "@tanstack/react-router";
import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  PaperclipIcon,
  UserRoundPenIcon,
} from "lucide-react";

import { Tab, Tabs, TabsList } from "@/_components/ui/tabs";

const paths = [
  {
    name: "Account",
    path: "/settings/account",
    icon: CircleUserRoundIcon,
  },
  {
    name: "Statistics",
    path: "/settings/statistics",
    icon: ChartNoAxesColumnIcon,
  },
  {
    name: "Customize",
    path: "/settings/customize",
    icon: Columns3CogIcon,
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
    path: "/settings/ai-profiles",
    icon: UserRoundPenIcon,
  },
];

export function UserNavbar() {
  const { pathname, search } = useLocation();
  const activeTab = paths.find((p) => pathname.startsWith(p.path));

  return (
    <Tabs value={activeTab ? "tab-" + activeTab.name : null}>
      <TabsList>
        {paths.map(({ path, name, icon: Icon }) => (
          <Tab key={path} value={"tab-" + name} className="h-10 px-0">
            <Link
              to={path}
              search={search}
              className="flex size-full items-center justify-center gap-1.5 px-2"
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
