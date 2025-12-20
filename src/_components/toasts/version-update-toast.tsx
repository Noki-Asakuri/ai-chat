import { toast } from "sonner";

import { VersionUpdateToastComponent } from "@/components/toasts/version-update-toast-component";

type VersionUpdateToastHandlers = {
  onRefresh: () => void;
  onRemindLater: () => void;
  onDismiss: () => void;
};

export function showVersionUpdateToast(handlers: VersionUpdateToastHandlers): string | number {
  let toastId: string | number = "";

  toastId = toast(
    () => (
      <VersionUpdateToastComponent
        onRefresh={() => {
          handlers.onRefresh();
        }}
        onRemindLater={() => {
          handlers.onRemindLater();
          toast.dismiss(toastId);
        }}
      />
    ),
    {
      duration: Infinity,
      position: "bottom-right",
      onDismiss: () => {
        handlers.onDismiss();
      },
    },
  );

  return toastId;
}
