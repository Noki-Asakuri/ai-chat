import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SettingsSectionProps = {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SettingsSection(props: SettingsSectionProps) {
  const headingId = `${props.id}-heading`;

  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col", props.className)}>
      <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight">
            {props.title}
          </h2>
          {props.description && (
            <p className="max-w-3xl text-sm text-pretty text-muted-foreground">{props.description}</p>
          )}
        </div>
        {props.actions && <div className="w-full shrink-0 sm:w-auto">{props.actions}</div>}
      </div>

      {props.children}
    </section>
  );
}
