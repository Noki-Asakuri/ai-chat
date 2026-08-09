import { toast } from "@/components/ui/toast";

import { VersionUpdateToastComponent } from "@/components/toasts/version-update-toast-component";

type VersionUpdateToastHandlers = {
  onRefresh: () => void;
  onRemindLater: () => void;
  onDismiss: () => void;
};

export function showVersionUpdateToast(handlers: VersionUpdateToastHandlers): string {
  let toastId = "";

  toastId = toast.add({
    type: "info",
    title: "New version available",
    description: "Refresh the page to get the latest updates.",
    timeout: 0,
    onClose: handlers.onDismiss,
    data: {
      content: (
        <VersionUpdateToastComponent
          onRefresh={handlers.onRefresh}
          onRemindLater={() => {
            handlers.onRemindLater();
            toast.close(toastId);
          }}
        />
      ),
    },
  });

  return toastId;
}
