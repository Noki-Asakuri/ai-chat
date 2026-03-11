import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { dispatchNavigateToThreadEvent } from "@/lib/chat/notification-navigation";
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

function openThread(threadId: Id<"threads">): void {
  if (typeof window === "undefined") return;

  window.focus();
  dispatchNavigateToThreadEvent({ threadId, source: "notification" });
}

function registerNotificationClick(notification: Notification, threadId: Id<"threads">): void {
  notification.onclick = () => {
    openThread(threadId);
    notification.close();
  };
}

function showDesktopNotification(
  status: StreamFeedbackStatus,
  threadId: Id<"threads">,
  errorMessage?: string,
): void {
  const threadTitle = getThreadTitle(threadId);
  const threadPath = getThreadPath(threadId);

  if (status === "success") {
    const notification = new Notification(threadTitle, {
      body: "Response finished streaming.",
      icon: "/icon-192.png",
      tag: `chat-stream-success-${threadId}`,
      silent: true,
      data: { threadPath },
    });

    registerNotificationClick(notification, threadId);

    return;
  }

  const body =
    typeof errorMessage === "string" && errorMessage.trim().length > 0
      ? errorMessage
      : "The latest response failed to stream.";

  const notification = new Notification(threadTitle, {
    body: `Response failed: ${body}`,
    icon: "/icon-192.png",
    tag: `chat-stream-error-${threadId}`,
    silent: true,
    data: { threadPath },
  });

  registerNotificationClick(notification, threadId);
}

export function emitStreamFeedback(options: StreamFeedbackOptions): void {
  if (options.soundEnabled && isPageInactive()) {
    const soundPath = getSoundPath(options.status);
    playSound(soundPath);
  }

  if (!shouldShowDesktopNotification(options.desktopEnabled)) return;

  showDesktopNotification(options.status, options.threadId, options.errorMessage);
}
