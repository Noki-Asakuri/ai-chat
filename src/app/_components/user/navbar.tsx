"use client";

import { useDocumentTitle } from "@uidotdev/usehooks";
import { NavLink, useLocation } from "react-router";

import { Tab, Tabs, TabsList } from "@/components/ui/tabs";

const paths = [
  {
    name: "Account",
    path: "/auth/settings/account",
  },
  {
    name: "Statistics",
    path: "/auth/settings/statistics",
  },
  {
    name: "Customize",
    path: "/auth/settings/customize",
  },
  {
    name: "Attachments",
    path: "/auth/settings/attachments",
  },
  {
    name: "Models",
    path: "/auth/settings/models",
  },
  {
    name: "AI Profiles",
    path: "/auth/settings/ai-profiles",
  },
];

export function UserNavbar() {
  const location = useLocation();
  const activeTitle = paths.find((path) => path.path === location.pathname)?.name;

  useDocumentTitle(activeTitle ? `${activeTitle} - AI Chat` : "Account - AI Chat");

  return (
    <Tabs value={"tab-" + activeTitle} onValueChange={() => null}>
      <TabsList>
        {paths.map(({ path, name }) => (
          <Tab key={path} value={"tab-" + name} className="h-10 px-0">
            <NavLink to={path} className="flex h-full w-full items-center justify-center px-2">
              {name}
            </NavLink>
          </Tab>
        ))}
      </TabsList>
    </Tabs>
  );
}
