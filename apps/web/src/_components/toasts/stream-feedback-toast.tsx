import { toast } from "sonner";

import { StreamFeedbackToastComponent } from "@/components/toasts/stream-feedback-toast-component";

type ShowStreamFeedbackToastOptions = {
  status: "success" | "error";
  threadId: string;
  threadTitle: string;
  description: string;
  onOpenThread: () => void;
};

export function showStreamFeedbackToast(options: ShowStreamFeedbackToastOptions): string | number {
  let toastId: string | number = "";

  toastId = toast(
    () => (
      <StreamFeedbackToastComponent
        status={options.status}
        threadTitle={options.threadTitle}
        description={options.description}
        onClose={() => {
          toast.dismiss(toastId);
        }}
        onOpenThread={() => {
          options.onOpenThread();
          toast.dismiss(toastId);
        }}
      />
    ),
    {
      id: `chat-stream-${options.status}-${options.threadId}`,
      duration: 12000,
      position: "bottom-right",
    },
  );

  return toastId;
}
