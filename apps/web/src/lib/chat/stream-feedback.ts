import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { showStreamFeedbackToast } from "@/components/toasts/stream-feedback-toast";
import { dispatchNavigateToThreadEvent } from "@/lib/chat/notification-navigation";
import { useMessageStore } from "@/lib/store/messages-store";
import { useThreadStore } from "@/lib/store/thread-store";
import { toUUID } from "@/lib/utils";

type StreamFeedbackStatus = "success" | "error";

type StreamFeedbackOptions = {
  status: StreamFeedbackStatus;
  threadId: Id<"threads">;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  errorMessage?: string;
};

const SUCCESS_SOUND_PATH = "/sounds/notification-success.mp3";
const ERROR_SOUND_PATH = "/sounds/notification-error.mp3";

function getSoundPath(status: StreamFeedbackStatus): string {
  if (status === "success") {
    return SUCCESS_SOUND_PATH;
  }

  return ERROR_SOUND_PATH;
}

function playSound(path: string): void {
  if (typeof Audio === "undefined") return;

  const audio = new Audio(path);
  void audio.play().catch(() => {
    // Ignore playback errors (autoplay policy, unsupported codecs, etc).
  });
}

function isPageInactive(): boolean {
  if (typeof document === "undefined") return false;

  return document.hidden || !document.hasFocus();
}

function isViewingDifferentThread(threadId: Id<"threads">): boolean {
  const currentThreadId = useMessageStore.getState().currentThreadId;
  return currentThreadId !== threadId;
}

function shouldShowDesktopNotification(desktopEnabled: boolean): boolean {
  if (!desktopEnabled) return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;

  return isPageInactive();
}

function getThreadTitle(threadId: Id<"threads">): string {
  const groupedThreads = useThreadStore.getState().groupedThreads.threads;
  const thread = groupedThreads.find((item) => item._id === threadId);
  if (thread && thread.title.trim().length > 0) {
    return thread.title;
  }

  return `Thread ${threadId.slice(-6)}`;
}

function getThreadPath(threadId: Id<"threads">): string {
  return `/threads/${toUUID(threadId)}`;
}

function openThread(threadId: Id<"threads">, source: "notification" | "toast"): void {
  if (typeof window === "undefined") return;

  window.focus();
  dispatchNavigateToThreadEvent({ threadId, source });
}

function registerNotificationClick(notification: Notification, threadId: Id<"threads">): void {
  notification.onclick = () => {
    openThread(threadId, "notification");
    notification.close();
  };
}

function getStreamFeedbackDescription(status: StreamFeedbackStatus, errorMessage?: string): string {
  if (status === "success") {
    return "The latest reply finished streaming while you were in another thread.";
  }

  if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
    return errorMessage;
  }

  return "The latest reply could not finish streaming.";
}

function showInAppToast(
  status: StreamFeedbackStatus,
  threadId: Id<"threads">,
  errorMessage?: string,
): void {
  const threadTitle = getThreadTitle(threadId);

  showStreamFeedbackToast({
    status,
    threadId,
    threadTitle,
    description: getStreamFeedbackDescription(status, errorMessage),
    onOpenThread: () => {
      openThread(threadId, "toast");
    },
  });
}

function showDesktopNotification(
  status: StreamFeedbackStatus,
  threadId: Id<"threads">,
  errorMessage?: string,
): void {
  const threadTitle = getThreadTitle(threadId);
  const threadPath = getThreadPath(threadId);
  const body = getStreamFeedbackDescription(status, errorMessage);

  if (status === "success") {
    const notification = new Notification(threadTitle, {
      body,
      icon: "/icon-192.png",
      tag: `chat-stream-success-${threadId}`,
      silent: true,
      data: { threadPath },
    });

    registerNotificationClick(notification, threadId);

    return;
  }

  const notification = new Notification(threadTitle, {
    body,
    icon: "/icon-192.png",
    tag: `chat-stream-error-${threadId}`,
    silent: true,
    data: { threadPath },
  });

  registerNotificationClick(notification, threadId);
}

export function emitStreamFeedback(options: StreamFeedbackOptions): void {
  const pageInactive = isPageInactive();

  if (options.soundEnabled && pageInactive) {
    const soundPath = getSoundPath(options.status);
    playSound(soundPath);
  }

  if (!pageInactive && isViewingDifferentThread(options.threadId)) {
    showInAppToast(options.status, options.threadId, options.errorMessage);
    return;
  }

  if (!shouldShowDesktopNotification(options.desktopEnabled)) return;

  showDesktopNotification(options.status, options.threadId, options.errorMessage);
}
