"use client";

import { Button } from "@/components/ui/button";

type VersionUpdateToastComponentProps = {
  onRefresh: () => void;
  onRemindLater: () => void;
};

export function VersionUpdateToastComponent(props: VersionUpdateToastComponentProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-snug">
        A new version is available.{" "}
        <span className="text-muted-foreground">Refresh the page to get the latest updates.</span>
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={props.onRemindLater}>
          Remind later
        </Button>

        <Button type="button" size="sm" onClick={props.onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
