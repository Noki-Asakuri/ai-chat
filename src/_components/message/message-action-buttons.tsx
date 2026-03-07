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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
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

type DeleteScope = "turnAndBelow" | "assistantVariantOnly";

type DeleteState = {
  threadId: Id<"threads"> | null;
  turnDeleteCount: number;
  variantDeleteCount: number;
  turnAttachmentCount: number;
  variantAttachmentCount: number;
  assistantTurnVariantCount: number;
  assistantLaterDeleteCount: number;
  canDeleteVariantOnly: boolean;
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
    <div className="flex items-center gap-0.5 rounded-md border border-border/70 bg-card/95 p-0.5 shadow-lg backdrop-blur-xl backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-border/70">
      {isFinished && (
        <>
          <CopyButton
            side="top"
            className="size-7"
            content={message.status === "error" ? message.error || "" : content}
          />

          {message.role === "assistant" && (
            <ButtonWithTip
              variant="ghost"
              side="top"
              className="size-7"
              onClick={() => branchThread(message._id)}
              title="Branch off at this message"
              disabled={message.status === "pending" || message.status === "streaming"}
            >
              <SplitIcon className="size-3.5 rotate-180" />
            </ButtonWithTip>
          )}

          {canRetry && retryUserMessageId && (
            <MessageRetryMenu
              userMessageId={retryUserMessageId}
              message={message}
              className="size-7"
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
      side="top"
      className="size-7"
      title="Debug"
      onClick={handleDebug}
    >
      <BugPlayIcon className="size-3.5" />
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
      side="top"
      className="size-7"
      onClick={handleEditMessage}
      disabled={isPending}
      title="Edit Message"
    >
      <PencilIcon className="size-3.5" />
      <span className="sr-only">Edit Message</span>
    </ButtonWithTip>
  );
}

function DeleteButton({ message }: { message: ChatMessage }) {
  const deleteMessageAndBelow = useSessionMutation(api.functions.messages.deleteMessageAndBelow);
  const [open, setOpen] = React.useState(false);
  const [deleteAttachments, setDeleteAttachments] = React.useState(false);
  const [deleteScope, setDeleteScope] = React.useState<DeleteScope>("turnAndBelow");
  const [pending, startTransition] = React.useTransition();

  const {
    threadId,
    turnDeleteCount,
    variantDeleteCount,
    turnAttachmentCount,
    variantAttachmentCount,
    assistantTurnVariantCount,
    assistantLaterDeleteCount,
    canDeleteVariantOnly,
    isStreaming,
  } = useMessageStore(
    useShallow((state): DeleteState => {
      const messageIndex = state.messageIds.indexOf(message._id);
      const canonicalUserMessageIds: Array<Id<"messages">> = [];

      for (const currentMessageId of state.messageIds) {
        const currentMessage = state.messagesById[currentMessageId];
        if (!currentMessage || currentMessage.role !== "user") continue;
        canonicalUserMessageIds.push(currentMessage._id);
      }

      let targetUserMessageId: Id<"messages"> | null = null;

      if (message.role === "user") {
        targetUserMessageId = message._id;
      } else {
        targetUserMessageId =
          state.userMessageIdByMessageId[message._id] ?? message.parentUserMessageId ?? null;

        if (!targetUserMessageId && messageIndex > 0) {
          for (let i = messageIndex - 1; i >= 0; i -= 1) {
            const previousMessageId = state.messageIds[i];
            if (!previousMessageId) continue;

            const previousMessage = state.messagesById[previousMessageId];
            if (!previousMessage || previousMessage.role !== "user") continue;

            targetUserMessageId = previousMessage._id;
            break;
          }
        }
      }

      const targetUserTurnIndex = targetUserMessageId
        ? canonicalUserMessageIds.indexOf(targetUserMessageId)
        : -1;

      const turnDeleteMessageIds = new Set<Id<"messages">>();
      let assistantTurnVariantCount = 0;
      let assistantLaterDeleteCount = 0;

      if (targetUserTurnIndex >= 0) {
        if (message.role === "assistant" && targetUserMessageId) {
          const targetVariants = state.variantMessageIdsByUserMessageId[targetUserMessageId] ?? [];

          if (targetVariants.length > 0) {
            assistantTurnVariantCount = targetVariants.length;

            for (const variantId of targetVariants) {
              turnDeleteMessageIds.add(variantId);
            }
          } else {
            assistantTurnVariantCount = 1;
            turnDeleteMessageIds.add(message._id);
          }
        }

        const startTurnIndex =
          message.role === "user" ? targetUserTurnIndex : targetUserTurnIndex + 1;

        for (let i = startTurnIndex; i < canonicalUserMessageIds.length; i += 1) {
          const userMessageId = canonicalUserMessageIds[i];
          if (!userMessageId) continue;

          turnDeleteMessageIds.add(userMessageId);

          const variants = state.variantMessageIdsByUserMessageId[userMessageId] ?? [];

          if (message.role === "assistant") {
            assistantLaterDeleteCount += 1 + variants.length;
          }

          for (const variantId of variants) {
            turnDeleteMessageIds.add(variantId);
          }
        }
      }

      const turnAttachmentIds = new Set<Id<"attachments">>();

      for (const turnDeleteMessageId of turnDeleteMessageIds) {
        const currentMessage = state.messagesById[turnDeleteMessageId];
        if (!currentMessage) continue;

        for (const attachment of currentMessage.attachments) {
          turnAttachmentIds.add(attachment._id);
        }
      }

      let variantDeleteCount = 0;
      let variantAttachmentCount = 0;
      let canDeleteVariantOnly = false;

      if (message.role === "assistant") {
        const userMessageId = targetUserMessageId;

        if (userMessageId) {
          const variants = state.variantMessageIdsByUserMessageId[userMessageId] ?? [];
          canDeleteVariantOnly = variants.length > 1;

          if (canDeleteVariantOnly) {
            variantDeleteCount = 1;
            const targetMessage = state.messagesById[message._id];

            if (targetMessage) {
              const variantAttachmentIds = new Set<Id<"attachments">>();

              for (const attachment of targetMessage.attachments) {
                variantAttachmentIds.add(attachment._id);
              }

              variantAttachmentCount = variantAttachmentIds.size;
            }
          }
        }
      }

      const lastMessageId = state.messageIds.at(-1);
      const lastStatus = lastMessageId ? state.messagesById[lastMessageId]?.status : "complete";

      return {
        threadId: state.currentThreadId,
        turnDeleteCount: turnDeleteMessageIds.size,
        variantDeleteCount,
        turnAttachmentCount: turnAttachmentIds.size,
        variantAttachmentCount,
        assistantTurnVariantCount,
        assistantLaterDeleteCount,
        canDeleteVariantOnly,
        isStreaming: lastStatus === "pending" || lastStatus === "streaming",
      };
    }),
  );

  const effectiveDeleteScope: DeleteScope = canDeleteVariantOnly ? deleteScope : "turnAndBelow";
  const deleteCount =
    effectiveDeleteScope === "assistantVariantOnly" ? variantDeleteCount : turnDeleteCount;
  const attachmentCount =
    effectiveDeleteScope === "assistantVariantOnly" ? variantAttachmentCount : turnAttachmentCount;

  const disabled = pending || !threadId || deleteCount === 0;
  const title = getDeleteTitle(
    deleteCount,
    effectiveDeleteScope,
    message.role,
    assistantTurnVariantCount,
    assistantLaterDeleteCount,
  );
  const deleteButtonTitle =
    effectiveDeleteScope === "assistantVariantOnly"
      ? "Delete response variant"
      : "Delete message and below";
  const deleteButtonSrLabel =
    effectiveDeleteScope === "assistantVariantOnly"
      ? "Delete response variant"
      : "Delete message and below";

  React.useEffect(() => {
    if (canDeleteVariantOnly) {
      setDeleteScope("assistantVariantOnly");
      return;
    }

    setDeleteScope("turnAndBelow");
  }, [canDeleteVariantOnly, message._id]);

  if (isStreaming) return null;

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    setDeleteScope(canDeleteVariantOnly ? "assistantVariantOnly" : "turnAndBelow");

    if (!nextOpen) {
      setDeleteAttachments(false);
    }
  }

  function handleDelete() {
    if (!threadId || deleteCount === 0) return;

    const requestedScope: DeleteScope = canDeleteVariantOnly ? deleteScope : "turnAndBelow";

    const shouldClearEditMessage = shouldClearEditMessageForTarget(message._id, requestedScope);

    startTransition(async () => {
      try {
        const result = await deleteMessageAndBelow({
          threadId,
          messageId: message._id,
          deleteAttachments,
          deleteScope: requestedScope,
        });

        if (shouldClearEditMessage) {
          chatStoreActions.setEditMessage(null);
        }

        handleOpenChange(false);

        const deletedMessageCount = result.deletedDocumentMessages ?? result.deletedMessages;
        const deletedMessageLabel = deletedMessageCount === 1 ? "message" : "messages";
        const successTitle = `Deleted ${deletedMessageCount} ${deletedMessageLabel}`;

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
        side="top"
        className="size-7"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
        title={deleteButtonTitle}
      >
        <Trash2Icon className="size-3.5" />
        <span className="sr-only">{deleteButtonSrLabel}</span>
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

          {canDeleteVariantOnly && (
            <RadioGroup
              value={deleteScope}
              onValueChange={(value) => {
                if (value === "assistantVariantOnly" || value === "turnAndBelow") {
                  setDeleteScope(value);
                }
              }}
              className="gap-2"
            >
              <Label className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left">
                <RadioGroupItem value="assistantVariantOnly" className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm leading-none font-medium">Delete this variant only</span>
                  <span className="text-xs text-muted-foreground">
                    Keep newer messages in this thread.
                  </span>
                </span>
              </Label>

              <Label className="flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left">
                <RadioGroupItem value="turnAndBelow" className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm leading-none font-medium">
                    Delete this message and newer
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Also removes newer messages in this thread.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          )}

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

function shouldClearEditMessageForTarget(
  targetMessageId: Id<"messages">,
  deleteScope: DeleteScope,
): boolean {
  if (deleteScope === "assistantVariantOnly") {
    return false;
  }

  const editMessage = useChatStore.getState().editMessage;
  if (!editMessage) return false;

  const state = useMessageStore.getState();
  const targetIndex = state.messageIds.indexOf(targetMessageId);
  const editIndex = state.messageIds.indexOf(editMessage._id);

  if (targetIndex === -1) return false;
  if (editIndex === -1) return true;
  return editIndex >= targetIndex;
}

function getDeleteTitle(
  deleteCount: number,
  deleteScope: DeleteScope,
  role: ChatMessage["role"],
  assistantTurnVariantCount: number,
  assistantLaterDeleteCount: number,
): string {
  if (deleteCount <= 0) return "Delete this message?";

  if (deleteScope === "assistantVariantOnly") {
    return "Delete this variant?";
  }

  if (role === "assistant") {
    const sameTurnVariantCount = Math.max(1, assistantTurnVariantCount);
    const newerMessageCount = Math.max(0, assistantLaterDeleteCount);

    if (newerMessageCount === 0) {
      if (sameTurnVariantCount <= 1) {
        return "Delete this response?";
      }

      return `Delete this response and ${sameTurnVariantCount - 1} alternate response${pluralize(sameTurnVariantCount - 1)}?`;
    }

    if (sameTurnVariantCount <= 1) {
      return `Delete this response and ${newerMessageCount} newer message${pluralize(newerMessageCount)}?`;
    }

    return `Delete this response turn and ${newerMessageCount} newer message${pluralize(newerMessageCount)}?`;
  }

  const newerMessageCount = Math.max(0, deleteCount - 1);
  if (newerMessageCount === 0) return "Delete this message?";
  return `Delete this message and ${newerMessageCount} newer message${pluralize(newerMessageCount)}?`;
}

function pluralize(value: number): string {
  return value === 1 ? "" : "s";
}
