"use client";

import { useDocumentTitle } from "@uidotdev/usehooks";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { Tab, Tabs, TabsList } from "@/components/ui/tabs";

const paths = [
  {
    name: "Account",
    path: "/settings/account",
  },
  {
    name: "Statistics",
    path: "/settings/statistics",
  },
  {
    name: "Customize",
    path: "/settings/customize",
  },
  {
    name: "Attachments",
    path: "/settings/attachments",
  },
  {
    name: "Models",
    path: "/settings/models",
  },
  {
    name: "AI Profiles",
    path: "/settings/ai-profiles",
  },
];

export function UserNavbar() {
  const pathname = usePathname();
  const activeTitle = paths.find(
    (p) => pathname === p.path || pathname.startsWith(p.path + "/"),
  )?.name;

  useDocumentTitle(activeTitle ? `${activeTitle} - AI Chat` : "Account - AI Chat");

  return (
    <Tabs value={"tab-" + activeTitle} onValueChange={() => null}>
      <TabsList>
        {paths.map(({ path, name }) => (
          <Tab key={path} value={"tab-" + name} className="h-10 px-0">
            <Link
              href={path}
              prefetch={false}
              className="flex h-full w-full items-center justify-center px-2"
            >
              {name}
            </Link>
          </Tab>
        ))}
      </TabsList>
    </Tabs>
  );
}
