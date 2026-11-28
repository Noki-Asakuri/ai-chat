import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

import { ChatActionButtons } from "./action-buttons";
import { ChatAttachmentsButton, ChatAttachmentsDisplay } from "./attachments-display";
import { composerSurfaceClassName } from "./composer-control";
import { MobileChatToolsMenu } from "./mobile-chat-tools-menu";
import { RichComposer } from "./rich-composer";
import { ChatSendButton } from "./send-button";
import { useComposerExpanded } from "./use-composer-expanded";

import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { isPastFileReadableBy, MAIN_COMPOSER_ID } from "@/lib/chat/composer-tokens";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { useConfigStore } from "../provider/config-provider";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { getConvexReactClient } from "@/lib/convex/client";
import { convexQuery } from "@convex-dev/react-query";
import { fromUUID, tryCatch } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ChatTextarea() {
  const parentRef = useRef<HTMLFormElement>(null);
  const { ref: composerRef, expanded, onFocusCapture, onBlurCapture } = useComposerExpanded();
  const onResize = useEffectEvent((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;

    // Minus the border width (1px) on both sides
    chatStoreActions.setTextareaHeight(entry.target.clientHeight - 2);
  });

  useEffect(() => {
    if (!parentRef.current) return undefined;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div data-slot="chat-textarea" className="pointer-events-none absolute bottom-2 w-full px-2 sm:px-4">
      <form ref={parentRef} className="mx-auto space-y-2">
        <SettledThreadNotice />

        <div className={composerSurfaceClassName}>
          <ChatAttachmentsDisplay />

          {/*
           * On phones the composer has two states. Collapsed (empty, not focused) it is one row:
           * attach, a one-line input and send. Expanded, the input takes the full width and attach,
           * tools, model picker and send move to a row below. Only the flex order changes, so the
           * input is never remounted and keeps focus. Wider screens always use the expanded layout.
           */}
          <div
            ref={composerRef}
            data-slot="chat-composer"
            data-expanded={expanded}
            className="group/composer flex flex-wrap content-start items-center gap-x-0.5 gap-y-1 px-2 pb-2 data-[expanded=false]:max-sm:pt-2"
            onFocusCapture={onFocusCapture}
            onBlurCapture={onBlurCapture}
          >
            <div className="order-1 min-w-0 basis-full px-2 group-data-[expanded=false]/composer:max-sm:order-2 group-data-[expanded=false]/composer:max-sm:flex-1 group-data-[expanded=false]/composer:max-sm:basis-0 group-data-[expanded=false]/composer:max-sm:px-1">
              <InputChatTextArea />
            </div>

            <ChatAttachmentsButton className="order-2 group-data-[expanded=false]/composer:max-sm:order-1" />

            <MobileChatToolsMenu className="order-3 group-data-[expanded=false]/composer:max-sm:hidden" />

            <div className="order-4 flex min-w-0 flex-1 group-data-[expanded=false]/composer:max-sm:hidden">
              <ChatActionButtons />
            </div>

            <div className="order-5 group-data-[expanded=false]/composer:max-sm:order-3">
              <ChatSendButton />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function SettledThreadNotice() {
  const [isUnsettling, startUnsettling] = useTransition();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data } = useQuery({
    enabled: threadId !== undefined,
    ...convexQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  });

  if (!threadId || data?.settled !== true) return null;

  function handleUnsettle(): void {
    startUnsettling(async () => {
      if (!threadId) return;

      const [, error] = await tryCatch(
        convexClient.mutation(api.functions.threads.unsettleThread, { threadId }),
      );
      if (!error) return;

      console.error("[Thread] Unsettle thread error:", error);
      toast.error("Failed to unsettle thread", { description: error.message });
    });
  }

  return (
    <Alert className="pointer-events-auto mx-auto max-w-4xl border-primary/50 bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <CircleCheckIcon className="text-primary" aria-hidden="true" />
      <AlertTitle>This thread is settled</AlertTitle>
      <AlertDescription>Sending a message moves it back to Active in the sidebar.</AlertDescription>
      <AlertAction className="top-1/2 -translate-y-1/2">
        <Button type="button" variant="outline" size="sm" disabled={isUnsettling} onClick={handleUnsettle}>
          {isUnsettling ? "Un-settling" : "Un-settle"}
        </Button>
      </AlertAction>
    </Alert>
  );
}

function InputChatTextArea() {
  const input = useChatStore((state) => state.input);
  const uploads = useChatStore((state) => state.attachments);
  const model = useConfigStore((state) => state.model);
  const { sendChatRequest } = useSendChatMessage();

  function handleAddAttachments({ files }: { files: File[] }) {
    const { attachments, rejectedCount } = prepareAttachmentsForModel(files, model);

    if (attachments.length > 0) {
      chatStoreActions.addAttachments(attachments);
    }

    if (rejectedCount > 0) {
      toast.error("File type not supported", {
        description: getAttachmentRejectionMessage(model),
      });
    }
  }

  return (
    <RichComposer
      id={MAIN_COMPOSER_ID}
      input={input}
      setInput={chatStoreActions.setInput}
      model={model}
      uploads={uploads}
      onRemoveChips={chatStoreActions.removeChipAttachments}
      // A past file the model can't read isn't sent, so its chip shows as just its name.
      isFileAttached={(attachmentId) => isPastFileReadableBy(model, attachmentId)}
      handleAddAttachments={handleAddAttachments}
      onConfirm={sendChatRequest}
      enableCommands
      compact
    />
  );
}
