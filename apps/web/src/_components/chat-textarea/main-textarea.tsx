import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "@/components/ui/toast";

import { Textarea } from "../ui/textarea";

import { ChatActionButtons } from "./action-buttons";
import { ChatAttachmentsDisplay } from "./attachments-display";
import { ChatSendButton } from "./send-button";

import { useGetSendDescription, useShouldSend } from "@/lib/chat/send-preference";
import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { useConfigStore } from "../provider/config-provider";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatTextarea() {
  const parentRef = useRef<HTMLFormElement>(null);
  const onResize = useEffectEvent((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;

    // Minus the border width (1px) on both sides
    chatStoreActions.setTextareaHeight(entry.target.clientHeight - 2);
  });

  useEffect(() => {
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div data-slot="chat-textarea" className="pointer-events-none absolute bottom-2 w-full px-4">
      <form ref={parentRef} className="mx-auto space-y-2">
        <div className="surface-edge pointer-events-auto relative mx-auto max-w-4xl space-y-2 rounded-md border bg-background/80 backdrop-blur-md backdrop-saturate-150">
          <ChatAttachmentsDisplay />

          <div>
            <InputChatTextArea />

            <div className="flex items-end justify-between border-t px-2.5 py-2">
              <ChatActionButtons />
              <ChatSendButton />
            </div>
          </div>
        </div>
      </form>
    </div>
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
    <BaseInputTextArea
      id="textarea-chat-input"
      input={input}
      setInput={chatStoreActions.setInput}
      handleAddAttachments={handleAddAttachments}
      onConfirm={sendChatRequest}
    />
  );
}

function TextareaDescription() {
  const sendDescription = useGetSendDescription();

  return (
    <span id="textarea-description" className="sr-only">
      {sendDescription}
    </span>
  );
}

type BaseInputTextAreaProps = React.ComponentPropsWithoutRef<typeof Textarea> & {
  input: string;
  setInput: (content: string) => void;

  handleAddAttachments: (data: { files: File[] }) => void;

  onConfirm?: () => void;
};

export function BaseInputTextArea({
  input,
  setInput,
  handleAddAttachments,
  onConfirm,
  onKeyDown,
  ...props
}: BaseInputTextAreaProps) {
  const shouldSend = useShouldSend();

  return (
    <div className="flex grow flex-row items-start p-2.5">
      <Textarea
        {...props}
        rows={3}
        name="user-input"
        autoComplete="off"
        aria-multiline="true"
        aria-autocomplete="none"
        aria-describedby="textarea-description"
        aria-label="Type your message here..."
        placeholder="Type your message here..."
        data-slot={props.id}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="max-h-62.5 w-full resize-none rounded-none border-0 bg-transparent! p-0 ring-0!"
        onPaste={(event) => {
          const { items } = event.clipboardData;
          const files = Array.from(items).reduce<Array<File>>((result, item) => {
            if (item.kind !== "file") return result;

            const file = item.getAsFile();
            if (file) result.push(file);

            return result;
          }, []);

          if (files.length === 0) return;

          event.preventDefault();
          event.stopPropagation();

          handleAddAttachments({ files });
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.nativeEvent.isComposing) return;

          const send = shouldSend({
            key: event.key,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          });

          if (!send) return;

          event.preventDefault();
          onConfirm?.();
        }}
      />

      <TextareaDescription />
    </div>
  );
}
