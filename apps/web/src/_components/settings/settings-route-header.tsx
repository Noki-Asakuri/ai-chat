import { useLocation } from "@tanstack/react-router";

import { getSettingsNavigationItem } from "./settings-navigation";

export function SettingsRouteHeader() {
  const { pathname } = useLocation();
  const currentPage = getSettingsNavigationItem(pathname);

  if (!currentPage) return null;

  return (
    <div className="flex w-full flex-col gap-1 py-6">
      <h1 className="text-2xl font-bold text-balance">{currentPage.label}</h1>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground sm:text-base">
        {currentPage.description}
      </p>
    </div>
  );
}
