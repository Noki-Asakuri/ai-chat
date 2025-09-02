"use client";

import { FileUpIcon, GlobeIcon, Loader2Icon, SaveIcon, XIcon } from "lucide-react";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";

import { ButtonWithTip } from "../ui/button";
import { Textarea } from "../ui/textarea";

import { ModelSelector } from "../chat-textarea/model-selector";
import { MessageEditAttachments } from "./message-edit-attachments";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { getModelData } from "@/lib/chat/models";
import { useChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";
import { getConvexReactClient } from "@/lib/convex/client";
import { uploadFile } from "@/lib/convex/uploadFiles";
import type { ChatMessage, UserAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const convexClient = getConvexReactClient();

type MessageEditComposerProps = {
  message: ChatMessage;
  index: number;
};

type AttachmentOverride = {
  _id: Id<"attachments">;
  id: string;
  threadId: Id<"threads">;
  name: string;
  size: number;
  type: "image" | "pdf";
};

export function MessageEditComposer({ message, index }: MessageEditComposerProps) {
  const chatConfig = useChatStore((s) => s.chatConfig);
  const setEditMessage = useChatStore((s) => s.setEditMessage);
  const assistantMessage = useChatStore((s) => s.messages[index + 1]);

  const { retryMessage } = useChatRequest();

  const initialModel =
    assistantMessage && assistantMessage.model.length > 0
      ? assistantMessage.model
      : chatConfig.model;

  const [text, setText] = React.useState(message.content);
  const [modelId, setModelId] = React.useState(initialModel);
  const [webSearch, setWebSearch] = React.useState(chatConfig.webSearch);
  const [savingPhase, setSavingPhase] = React.useState<"idle" | "uploading" | "saving">("idle");

  // New attachments management (local only until Save)
  const [newFiles, setNewFiles] = React.useState<Array<UserAttachment>>([]);

  // Existing attachments management (unlink by marking removed ids)
  const [removed, setRemoved] = React.useState(new Set<Id<"attachments">>());
  function toggleRemoveExisting(id: Id<"attachments">) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addFiles(files: Array<File>) {
    const accepted = files.filter((f) => f.type.includes("image") || f.type.includes("pdf"));
    if (accepted.length !== files.length) {
      // Lazy toast import pattern avoided to keep file self-contained; UI elsewhere already surfaces unsupported feedback.
      console.warn("[Edit] Some files were not accepted (only image/pdf).");
    }
    if (accepted.length === 0) return;

    const mapped = accepted.map((file) => {
      let type: "image" | "pdf" = "image";
      if (file.type.includes("pdf")) type = "pdf";
      return { id: uuidv4(), name: file.name, size: file.size, file, type } as UserAttachment;
    });

    setNewFiles((prev) => [...prev, ...mapped]);
  }

  function removeNew(id: string) {
    setNewFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const hasVision = getModelData(modelId)?.capabilities.vision ?? false;
  const canWebSearch = getModelData(modelId)?.capabilities.webSearch ?? false;

  // Shape used for per-retry attachments override (not full Doc<"attachments">)

  function onBottomFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    addFiles([file]);
    // clear value to allow uploading the same file again
    event.currentTarget.value = "";
  }

  async function persistAttachmentChanges(): Promise<{
    finalIds: Array<Id<"attachments">>;
    attachmentsOverride: AttachmentOverride[];
  }> {
    // Keep existing not-removed
    const keptExisting = message.attachments.filter((a) => !removed.has(a._id));

    // Delete removed existing attachments (DB + R2) in bulk before re-linking
    const removedExisting = message.attachments.filter((a) => removed.has(a._id));
    if (removedExisting.length) {
      await convexClient.mutation(api.functions.attachments.deleteAttachments, {
        attachmentIds: removedExisting.map((a) => a._id),
      });
    }

    // Upload new ones and create attachment docs
    const created = await Promise.all(
      newFiles.map(async (att) => {
        const createdId = await convexClient.mutation(api.functions.attachments.createAttachment, {
          id: att.id,
          name: att.name,
          size: att.size,
          type: att.type,
          threadId: message.threadId,
        });

        await uploadFile(att.file, message.threadId, createdId);

        return {
          _id: createdId,
          id: att.id,
          threadId: message.threadId,
          name: att.name,
          size: att.size,
          type: att.type,
        };
      }),
    );

    const finalIds: Array<Id<"attachments">> = [
      ...keptExisting.map((a) => a._id),
      ...created.map((a) => a._id),
    ];

    const attachmentsOverride: AttachmentOverride[] = [
      ...keptExisting.map((a) => ({
        _id: a._id,
        id: a.id,
        threadId: a.threadId,
        name: a.name,
        size: a.size,
        type: a.type,
      })),
      ...created,
    ];

    // Write exact list to user message (unlink/link only, no file deletion)
    await convexClient.mutation(api.functions.messages.updateMessageById, {
      threadId: message.threadId,
      messageId: message._id,
      updates: { attachments: finalIds },
    });

    return { finalIds, attachmentsOverride };
  }

  async function handleSave() {
    if (savingPhase !== "idle") return;

    const hasUploads = newFiles.length > 0;
    setSavingPhase(hasUploads ? "uploading" : "saving");

    try {
      // Apply local attachment changes (create + link, unlink removed)
      const { attachmentsOverride } = await persistAttachmentChanges();

      // If there were uploads, we are past upload stage now
      if (hasUploads) setSavingPhase("saving");

      // Retry message with one-shot overrides
      const bodyEdited =
        text.trim() !== message.content.trim()
          ? { _id: message._id, content: text.trim() }
          : undefined;

      await retryMessage(index, {
        editedUserMessage: bodyEdited,
        modelId,
        webSearch: canWebSearch ? webSearch : false,
        attachmentsOverride,
      });

      setEditMessage(null);
    } finally {
      setSavingPhase("idle");
    }
  }

  function handleCancel() {
    setEditMessage(null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSave();
    }
  }

  return (
    <div className="bg-muted/40 group-data-[disable-blur=true]/sidebar-provider:bg-muted pointer-events-auto mx-auto w-full max-w-4xl space-y-2 rounded-md border backdrop-blur-md backdrop-saturate-150">
      <MessageEditAttachments
        existing={message.attachments}
        removed={removed}
        onToggleRemove={toggleRemoveExisting}
        newFiles={newFiles}
        onAddFiles={(files) => addFiles(files)}
        onRemoveNew={removeNew}
        modelId={modelId}
        userId={message.userId}
        threadId={message.threadId}
      />

      <div className="flex flex-col">
        <div className="flex flex-grow flex-row items-start p-2.5">
          <Textarea
            rows={3}
            id="textarea-user-message-edit"
            name="user-input"
            autoComplete="off"
            aria-multiline="true"
            aria-autocomplete="none"
            aria-describedby="textarea-edit-description"
            aria-label="Edit your message here..."
            placeholder="Edit your message here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="max-h-[250px] w-full resize-none rounded-none border-0 !bg-transparent p-0 !ring-0"
            onPaste={(event) => {
              const { items } = event.clipboardData;
              const files = Array.from(items)
                .filter((item) => item.kind === "file")
                .map((item) => item.getAsFile())
                .filter((file): file is File => file !== null);

              if (files.length === 0) return;

              event.preventDefault();
              event.stopPropagation();

              addFiles(files);
            }}
            onKeyDown={onKeyDown}
            disabled={savingPhase !== "idle"}
          />
          <span id="textarea-edit-description" className="sr-only">
            Press enter to save. Shift + enter or Ctrl + enter to add new line.
          </span>
        </div>

        <div className="flex items-end justify-between border-t px-2.5 py-2">
          <div
            className={cn("flex items-center justify-center gap-2", {
              "pointer-events-none opacity-60": savingPhase !== "idle",
            })}
          >
            <ModelSelector
              value={modelId}
              onChange={setModelId}
              triggerId="button-edit-model-selector-trigger"
            />

            <ButtonWithTip
              type="button"
              variant="secondary"
              data-active={webSearch}
              disabled={savingPhase !== "idle"}
              className={cn(
                "size-9 border px-2 py-1.5 text-xs data-[active=true]:border-blue-400 data-[active=true]:bg-blue-500/15",
                { hidden: !canWebSearch },
              )}
              onMouseDown={() => setWebSearch((s) => !s)}
              title={webSearch ? "Disable Web Search" : "Enable Web Search"}
            >
              <GlobeIcon className={cn("transition-colors", { "stroke-blue-400": webSearch })} />
              <span className="sr-only">
                {webSearch ? "Disable Web Search" : "Enable Web Search"}
              </span>
            </ButtonWithTip>

            {hasVision && (
              <>
                <ButtonWithTip
                  asChild
                  title="Upload Image/PDF"
                  variant="secondary"
                  className="size-9 border px-2 py-1.5 text-xs"
                >
                  <label htmlFor="message-edit-file-upload-bottom" className="cursor-pointer">
                    <FileUpIcon />
                    <span className="sr-only">Upload Image/PDF</span>
                  </label>
                </ButtonWithTip>

                <input
                  type="file"
                  id="message-edit-file-upload-bottom"
                  accept="image/*,application/pdf"
                  onChange={onBottomFileInputChange}
                  className="hidden"
                  disabled={savingPhase !== "idle"}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ButtonWithTip
              variant="secondary"
              className="h-9 px-3 text-xs"
              onMouseDown={handleCancel}
              title="Cancel Edit"
              disabled={savingPhase !== "idle"}
            >
              <XIcon className="size-4" />
              Cancel
            </ButtonWithTip>

            <ButtonWithTip
              type="button"
              variant="default"
              className={cn("h-9 px-3 text-xs", {
                "pointer-events-none opacity-90": savingPhase !== "idle",
              })}
              onMouseDown={handleSave}
              // title="Save Changes"
              disabled={savingPhase !== "idle"}
              title={savingPhase === "idle" ? "Save Changes" : "Saving..."}
            >
              {savingPhase === "uploading" ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}

              {savingPhase === "idle" ? "Save" : "Saving..."}
            </ButtonWithTip>
          </div>
        </div>
      </div>
    </div>
  );
}
