"use client";

import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import Link from "next/link";

const paths = [
  {
    name: "Account",
    path: "/auth/settings/account",
  },
  {
    name: "Usage",
    path: "/auth/settings/usage",
  },
  {
    name: "Customize",
    path: "/auth/settings/customize",
  },
  {
    name: "Models",
    path: "/auth/settings/models",
  },
  {
    name: "API Keys",
    path: "/auth/settings/api-keys",
  },
  {
    name: "Contact",
    path: "/auth/settings/contact",
  },
];

export function UserNavbar() {
  const pathname = usePathname();

  return (
    <div className="bg-primary/30 border-primary/50 w-max space-x-2 rounded-md border p-2">
      {paths.map(({ path, name }) => (
        <Button
          asChild
          key={path}
          variant="ghost"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-max px-2 py-1 text-base"
          data-state={pathname === path ? "active" : "inactive"}
        >
          <Link href={path}>{name}</Link>
        </Button>
      ))}
    </div>
  );
}
