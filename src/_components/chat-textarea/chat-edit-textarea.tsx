import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { ChatEditActionButtons } from "./action-buttons";
import { ChatEditAttachmentsDisplay } from "./chat-edit-attachments-display";
import { BaseInputTextArea } from "./main-textarea";
import { ChatEditSendButton } from "./send-button";

import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";

export function ChatEditTextarea() {
  const editMessage = useChatStore((state) => state.editMessage);

  if (!editMessage) return null;

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

      chatStoreActions.addEditAttachments(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
      });
    }
  }

  return (
    <div data-slot="chat-textarea" className="pointer-events-none">
      <form className="mx-auto space-y-2">
        <div className="pointer-events-auto relative mx-auto max-w-4xl space-y-2 rounded-md border bg-background/80 backdrop-blur-md backdrop-saturate-150">
          <ChatEditAttachmentsDisplay />

          <div>
            <BaseInputTextArea
              id="textarea-user-message-edit"
              input={editMessage.input}
              setInput={(input) => chatStoreActions.updateEditMessage({ input })}
              handleAddAttachments={handleAddAttachments}
            />

            <div className="flex items-end justify-between border-t px-2.5 py-2">
              <ChatEditActionButtons />
              <ChatEditSendButton />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
