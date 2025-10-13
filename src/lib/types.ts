import type { Doc } from "@/convex/_generated/dataModel";
import type { ChatRequestBody } from "@/lib/server/validate-request-body";

type Thread = Doc<"threads">;

type ReasoningEffort = NonNullable<Doc<"messages">["modelParams"]>["effort"];

type UserAttachment = {
  id: string;
  name: string;
  size: number;
  file: File;
  type: "image" | "pdf";
  mimeType: string;
};

type ChatMessage = Omit<Doc<"messages">, "attachments"> & {
  attachments: Doc<"attachments">[];
};

export type { ChatMessage, ChatRequestBody, ReasoningEffort, Thread, UserAttachment };
