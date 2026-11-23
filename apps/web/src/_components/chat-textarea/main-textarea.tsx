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
import { ChatAttachmentsDisplay } from "./attachments-display";
import { RichComposer } from "./rich-composer";
import { ChatSendButton } from "./send-button";

import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { useConfigStore } from "../provider/config-provider";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { getConvexReactClient } from "@/lib/convex/client";
import { convexQuery } from "@convex-dev/react-query";
import { fromUUID, tryCatch } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ChatTextarea() {
  const parentRef = useRef<HTMLFormElement>(null);
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

        <div className="surface-edge pointer-events-auto relative mx-auto max-w-4xl space-y-2 overflow-hidden rounded-xl border border-border/80 bg-background/80 shadow-lg backdrop-blur-md backdrop-saturate-150 transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-primary/45 focus-within:bg-background/85 focus-within:ring-2 focus-within:ring-primary/15 motion-reduce:transition-none">
          <ChatAttachmentsDisplay />

          <div>
            <InputChatTextArea />

            <div className="flex items-end gap-2 px-2 pt-1 pb-2.5 sm:px-3 sm:pb-3">
              <ChatActionButtons />
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
      id="textarea-chat-input"
      input={input}
      setInput={chatStoreActions.setInput}
      model={model}
      handleAddAttachments={handleAddAttachments}
      onConfirm={sendChatRequest}
      enableProfiles
    />
  );
}
