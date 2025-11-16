"use client";

import { useDocumentTitle } from "@uidotdev/usehooks";

import {
  BrainIcon,
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  Columns3CogIcon,
  LogOutIcon,
  PaperclipIcon,
  UserRoundPenIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { Tab, Tabs, TabsList } from "@/components/ui/tabs";

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
    name: "AI Profiles",
    path: "/settings/ai-profiles",
    icon: UserRoundPenIcon,
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
        {paths.map(({ path, name, icon: Icon }) => (
          <Tab key={path} value={"tab-" + name} className="h-10 px-0">
            <Link
              href={path}
              prefetch={false}
              className="flex h-full w-full items-center justify-center gap-1.5 px-2"
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
