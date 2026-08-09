import { toast } from "@/components/ui/toast";

import { StreamFeedbackToastComponent } from "@/components/toasts/stream-feedback-toast-component";

type ShowStreamFeedbackToastOptions = {
  status: "success" | "error";
  threadId: string;
  threadTitle: string;
  description: string;
  onOpenThread: () => void;
};

export function showStreamFeedbackToast(options: ShowStreamFeedbackToastOptions): string {
  let toastId = "";

  toastId = toast.add({
    type: options.status,
    title: options.status === "success" ? "Response ready" : "Response failed",
    description: `${options.threadTitle}. ${options.description}`,
    timeout: 12000,
    id: `chat-stream-${options.status}-${options.threadId}`,
    data: {
      content: (
        <StreamFeedbackToastComponent
          status={options.status}
          threadTitle={options.threadTitle}
          description={options.description}
          onClose={() => {
            toast.close(toastId);
          }}
          onOpenThread={() => {
            options.onOpenThread();
            toast.close(toastId);
          }}
        />
      ),
    },
  });

  return toastId;
}
