"use client";

import { NavLink } from "react-router";

import { buttonVariants } from "../ui/button";
import { cn } from "@/lib/utils";

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
  return (
    <div className="bg-primary/10 w-max space-x-2 rounded-md p-1">
      {paths.map(({ path, name }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            cn(buttonVariants({ variant: "ghost" }), "h-max px-3 py-1.5 text-base font-semibold", {
              "bg-background text-primary hover:bg-background/80": isActive,
            })
          }
        >
          {name}
        </NavLink>
      ))}
    </div>
  );
}
