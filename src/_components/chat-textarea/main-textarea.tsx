import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Textarea } from "../ui/textarea";

import { ChatActionButtons } from "./action-buttons";
import { ChatAttachmentsDisplay } from "./attachments-display";
import { ChatSendButton } from "./send-button";

import { useGetSendDescription, useShouldSend } from "@/lib/chat/send-preference";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatTextarea() {
  const parentRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={parentRef}
      data-slot="chat-textarea"
      className="pointer-events-none absolute bottom-2 w-full px-4"
    >
      <form className="mx-auto space-y-2">
        <div className="pointer-events-auto relative mx-auto max-w-4xl space-y-2 rounded-md border bg-background/80 backdrop-blur-md backdrop-saturate-150">
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

  function handleAddAttachments({ files }: { files: File[] }) {
    const acceptFiles = files.filter(
      (file) => file.type.includes("image") || file.type.includes("pdf"),
    );

    if (acceptFiles.length > 0) {
      const attachments = acceptFiles.map((file) => ({
        id: uuidv4(),
        file,
        type: (file.type.includes("image") ? "image" : "pdf") as "image" | "pdf",
      }));

      chatStoreActions.addAttachments(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
      });
    }
  }

  return (
    <BaseInputTextArea
      id="textarea-chat-input"
      input={input}
      setInput={chatStoreActions.setInput}
      handleAddAttachments={handleAddAttachments}
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
};

export function BaseInputTextArea({
  input,
  setInput,
  handleAddAttachments,
  ...props
}: BaseInputTextAreaProps) {
  const shouldSend = useShouldSend();
  const { sendChatRequest } = useSendChatMessage();

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
          const files = Array.from(items)
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);

          if (files.length === 0) return;

          event.preventDefault();
          event.stopPropagation();

          handleAddAttachments({ files });
        }}
        onKeyDown={(event) => {
          const send = shouldSend({
            key: event.key,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          });

          if (!send) return;

          event.preventDefault();
          sendChatRequest();
        }}
      />

      <TextareaDescription />
    </div>
  );
}
