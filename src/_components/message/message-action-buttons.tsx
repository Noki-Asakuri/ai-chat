import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSessionMutation } from "convex-helpers/react/sessions";
import {
  BugPlayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  PencilIcon,
  SplitIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";

import { CopyButton } from "../copy-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { ButtonWithTip } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { MessageRetryMenu } from "./message-retry-menu";

import { useBranchThread } from "@/lib/chat/server-function/branch-thread";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { messageStoreActions, useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";

type MessageActionButtonsProps = {
  isFinished: boolean;
  message: ChatMessage;
};

type RetryState = {
  canRetry: boolean;
  retryUserMessageId: Id<"messages"> | null;
};

type VariantPagerState = {
  threadId: Id<"threads"> | null;
  userMessageId: Id<"messages"> | null;
  variants: Array<Id<"messages">>;
  activeVariantIndex: number;
  isStreaming: boolean;
};

export function MessageActionButtons({ isFinished, message }: MessageActionButtonsProps) {
  const { branchThread } = useBranchThread();

  const { canRetry, retryUserMessageId } = useMessageStore(
    useShallow((state): RetryState => {
      const messageIndex = state.messageIds.indexOf(message._id);
      if (messageIndex < 0) return { canRetry: false, retryUserMessageId: null };

      if (message.role === "assistant") {
        const previousMessageId = state.messageIds[messageIndex - 1];
        if (!previousMessageId) {
          return { canRetry: false, retryUserMessageId: null };
        }

        const previousMessage = state.messagesById[previousMessageId];
        if (previousMessage?.role !== "user") {
          return { canRetry: false, retryUserMessageId: null };
        }

        return { canRetry: true, retryUserMessageId: previousMessage._id };
      }

      const nextMessageId = state.messageIds[messageIndex + 1];
      if (!nextMessageId) {
        return { canRetry: false, retryUserMessageId: null };
      }

      const nextMessage = state.messagesById[nextMessageId];
      if (nextMessage?.role !== "assistant") {
        return { canRetry: false, retryUserMessageId: null };
      }

      return { canRetry: true, retryUserMessageId: message._id };
    }),
  );

  if (import.meta.env.PROD && !isFinished) return null;

  const content = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background/80 p-1 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      {isFinished && (
        <>
          <CopyButton
            side="bottom"
            className="size-8"
            content={message.status === "error" ? message.error || "" : content}
          />

          {message.role === "assistant" && (
            <ButtonWithTip
              variant="ghost"
              side="bottom"
              className="size-8"
              onMouseDown={() => branchThread(message._id)}
              title="Branch off at this message"
              disabled={message.status === "pending" || message.status === "streaming"}
            >
              <SplitIcon className="size-4 rotate-180" />
            </ButtonWithTip>
          )}

          {canRetry && retryUserMessageId && (
            <MessageRetryMenu
              userMessageId={retryUserMessageId}
              message={message}
              className="size-8"
            />
          )}
        </>
      )}

      {isFinished && <DeleteButton message={message} />}
      <EditButton message={message} />
      <DebugButton messageId={message._id} />
    </div>
  );
}

export function MessageVariantPager({ message }: { message: ChatMessage }) {
  return <VariantPager message={message} />;
}

function DebugButton({ messageId }: { messageId: Id<"messages"> }) {
  const message = useMessageStore(useShallow((state) => state.messagesById[messageId]!));
  if (import.meta.env.PROD) return null;

  async function handleDebug() {
    console.log(message);

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(JSON.stringify(message, null, 2));
    }
  }

  return (
    <ButtonWithTip
      variant="ghost"
      side="bottom"
      className="size-8"
      title="Debug"
      onClick={handleDebug}
    >
      <BugPlayIcon className="size-4" />
      <span className="sr-only">Debug</span>
    </ButtonWithTip>
  );
}

function EditButton({ message }: { message: ChatMessage }) {
  const { canEdit, isPending, pairedAssistantMessage } = useMessageStore(
    useShallow((state) => {
      const lastMessageId = state.messageIds.at(-1);
      const lastStatus = lastMessageId ? state.messagesById[lastMessageId]?.status : "complete";

      if (message.role === "assistant") {
        return {
          canEdit: false,
          isPending: lastStatus === "pending" || lastStatus === "streaming",
          pairedAssistantMessage: null,
        };
      }

      const activeAssistantMessageId = state.activeAssistantMessageIdByUserMessageId[message._id];
      const pairedAssistantMessage = activeAssistantMessageId
        ? state.messagesById[activeAssistantMessageId]
        : null;

      return {
        canEdit: pairedAssistantMessage?.metadata !== undefined,
        isPending: lastStatus === "pending" || lastStatus === "streaming",
        pairedAssistantMessage,
      };
    }),
  );

  const pairedAssistantMetadata = pairedAssistantMessage?.metadata;
  if (!canEdit || !pairedAssistantMetadata) return null;

  function handleEditMessage() {
    const metadata = pairedAssistantMetadata;
    if (!metadata) return;

    chatStoreActions.setEditMessage({
      _id: message._id,
      input: message.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n\n"),

      attachments: [],
      currentAttachments: message.attachments,
      keptAttachmentIds: message.attachments.map((a) => a._id),
      model: metadata.model.request,
      modelParams: metadata.modelParams,
    });
  }

  return (
    <ButtonWithTip
      variant="ghost"
      side="bottom"
      className="size-8"
      onClick={handleEditMessage}
      disabled={isPending}
      title="Edit Message"
    >
      <PencilIcon className="size-4" />
      <span className="sr-only">Edit Message</span>
    </ButtonWithTip>
  );
}

function DeleteButton({ message }: { message: ChatMessage }) {
  const deleteMessageAndBelow = useSessionMutation(api.functions.messages.deleteMessageAndBelow);
  const [open, setOpen] = React.useState(false);
  const [deleteAttachments, setDeleteAttachments] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const { threadId, deleteCount, attachmentCount, isStreaming } = useMessageStore(
    useShallow((state) => {
      const messageIndex = state.messageIds.indexOf(message._id);
      const deleteCount = messageIndex < 0 ? 0 : state.messageIds.length - messageIndex;

      const attachmentIds = new Set<Id<"attachments">>();
      if (messageIndex >= 0) {
        for (let i = messageIndex; i < state.messageIds.length; i += 1) {
          const currentMessageId = state.messageIds[i];
          if (!currentMessageId) continue;

          const currentMessage = state.messagesById[currentMessageId];
          if (!currentMessage) continue;

          for (const attachment of currentMessage.attachments) {
            attachmentIds.add(attachment._id);
          }
        }
      }

      const lastMessageId = state.messageIds.at(-1);
      const lastStatus = lastMessageId ? state.messagesById[lastMessageId]?.status : "complete";

      return {
        threadId: state.currentThreadId,
        deleteCount,
        attachmentCount: attachmentIds.size,
        isStreaming: lastStatus === "pending" || lastStatus === "streaming",
      };
    }),
  );

  const disabled = pending || !threadId || deleteCount === 0;
  const title = getDeleteTitle(deleteCount);

  if (isStreaming) return null;

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDeleteAttachments(false);
    }
  }

  function handleDelete() {
    if (!threadId || deleteCount === 0) return;

    const shouldClearEditMessage = shouldClearEditMessageForTarget(message._id);

    startTransition(async () => {
      try {
        const result = await deleteMessageAndBelow({
          threadId,
          messageId: message._id,
          deleteAttachments,
        });

        if (shouldClearEditMessage) {
          chatStoreActions.setEditMessage(null);
        }

        handleOpenChange(false);

        const deletedMessageLabel = result.deletedMessages === 1 ? "message" : "messages";
        const successTitle = `Deleted ${result.deletedMessages} ${deletedMessageLabel}`;

        if (result.attachmentCountInDeletedRange > 0) {
          const attachmentTitle = deleteAttachments
            ? `Deleted ${result.deletedAttachments} attachment${pluralize(result.deletedAttachments)} from storage.`
            : `Unlinked ${result.attachmentCountInDeletedRange} attachment${pluralize(result.attachmentCountInDeletedRange)} from deleted messages.`;

          toast.success(successTitle, { description: attachmentTitle });
        } else {
          toast.success(successTitle);
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("chat:scroll-if-sticky"));
        }
      } catch (error) {
        toast.error("Failed to delete messages", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  return (
    <>
      <ButtonWithTip
        variant="ghost"
        side="bottom"
        className="size-8"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
        title="Delete message and below"
      >
        <Trash2Icon className="size-4" />
        <span className="sr-only">Delete message and below</span>
      </ButtonWithTip>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="gap-3 p-4">
          <AlertDialogHeader className="gap-1">
            <AlertDialogMedia className="bg-amber-500/15 text-amber-400">
              <TriangleAlertIcon className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {deleteCount} message
              {pluralize(deleteCount)} from this thread.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {attachmentCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`delete-message-attachments-${message._id}`}
                checked={deleteAttachments}
                onCheckedChange={(checked) => setDeleteAttachments(checked === true)}
                className="size-5"
              />

              <Label
                htmlFor={`delete-message-attachments-${message._id}`}
                className="text-sm leading-none"
              >
                Also delete eligible attachments from storage (up to {attachmentCount})?
              </Label>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={disabled}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2Icon className="size-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VariantPager({ message }: { message: ChatMessage }) {
  const setActiveVariant = useSessionMutation(api.functions.messages.setActiveAssistantVariant);
  const [pendingDirection, setPendingDirection] = React.useState<"prev" | "next" | null>(null);

  const { threadId, userMessageId, variants, activeVariantIndex, isStreaming } = useMessageStore(
    useShallow((state): VariantPagerState => {
      if (message.role !== "assistant") {
        return {
          threadId: state.currentThreadId,
          userMessageId: null,
          variants: [] as Array<Id<"messages">>,
          activeVariantIndex: -1,
          isStreaming: false,
        };
      }

      const userMessageId =
        state.userMessageIdByMessageId[message._id] ?? message.parentUserMessageId;
      if (!userMessageId) {
        return {
          threadId: state.currentThreadId,
          userMessageId: null,
          variants: [] as Array<Id<"messages">>,
          activeVariantIndex: -1,
          isStreaming: false,
        };
      }

      const variants = state.variantMessageIdsByUserMessageId[userMessageId] ?? [];
      const activeAssistantMessageId = state.activeAssistantMessageIdByUserMessageId[userMessageId];
      const activeVariantIndex = activeAssistantMessageId
        ? variants.indexOf(activeAssistantMessageId)
        : variants.indexOf(message._id);

      const nonNullUserMessageId: Id<"messages"> = userMessageId;

      const lastMessageId = state.messageIds.at(-1);
      const lastStatus = lastMessageId ? state.messagesById[lastMessageId]?.status : "complete";

      return {
        threadId: state.currentThreadId,
        userMessageId: nonNullUserMessageId,
        variants,
        activeVariantIndex,
        isStreaming: lastStatus === "pending" || lastStatus === "streaming",
      };
    }),
  );

  if (!userMessageId || variants.length <= 1 || activeVariantIndex < 0) return null;

  const canGoPrev = activeVariantIndex > 0;
  const canGoNext = activeVariantIndex < variants.length - 1;
  const isPending = pendingDirection !== null;
  const ensuredUserMessageId: Id<"messages"> = userMessageId;

  async function switchVariant(nextVariantIndex: number, direction: "prev" | "next") {
    if (!threadId || isPending || isStreaming) return;

    const previousAssistantMessageId = variants[activeVariantIndex];
    const nextAssistantMessageId = variants[nextVariantIndex];
    if (!nextAssistantMessageId) return;

    setPendingDirection(direction);

    try {
      messageStoreActions.selectAssistantVariant(
        threadId,
        ensuredUserMessageId,
        nextAssistantMessageId,
      );

      await setActiveVariant({
        threadId,
        userMessageId: ensuredUserMessageId,
        assistantMessageId: nextAssistantMessageId,
      });
    } catch (error) {
      if (previousAssistantMessageId) {
        messageStoreActions.selectAssistantVariant(
          threadId,
          ensuredUserMessageId,
          previousAssistantMessageId,
        );
      }

      toast.error("Failed to switch response", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setPendingDirection(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-background/80 p-1 backdrop-blur-md backdrop-saturate-150">
      <ButtonWithTip
        variant="ghost"
        side="bottom"
        className="size-8"
        title="Previous response"
        disabled={!canGoPrev || isPending || isStreaming}
        onClick={() => void switchVariant(activeVariantIndex - 1, "prev")}
      >
        {pendingDirection === "prev" ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <ChevronLeftIcon className="size-4" />
        )}
      </ButtonWithTip>

      <span className="min-w-10 text-center text-xs text-muted-foreground">
        {activeVariantIndex + 1}/{variants.length}
      </span>

      <ButtonWithTip
        variant="ghost"
        side="bottom"
        className="size-8"
        title="Next response"
        disabled={!canGoNext || isPending || isStreaming}
        onClick={() => void switchVariant(activeVariantIndex + 1, "next")}
      >
        {pendingDirection === "next" ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
      </ButtonWithTip>
    </div>
  );
}

function shouldClearEditMessageForTarget(targetMessageId: Id<"messages">): boolean {
  const editMessage = useChatStore.getState().editMessage;
  if (!editMessage) return false;

  const state = useMessageStore.getState();
  const targetIndex = state.messageIds.indexOf(targetMessageId);
  const editIndex = state.messageIds.indexOf(editMessage._id);

  if (targetIndex === -1) return false;
  if (editIndex === -1) return true;
  return editIndex >= targetIndex;
}

function getDeleteTitle(deleteCount: number): string {
  const newerMessageCount = Math.max(0, deleteCount - 1);
  if (newerMessageCount === 0) return "Delete this message?";
  return `Delete this message and ${newerMessageCount} newer message${pluralize(newerMessageCount)}?`;
}

function pluralize(value: number): string {
  return value === 1 ? "" : "s";
}
