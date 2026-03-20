import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { safetySettings } from "@ai-chat/shared/chat/request";

import { generateText, type ModelMessage, type TextPart } from "ai";
import dedent from "dedent";

import { type ServerConvexClient } from "./convex-client";
import { registry } from "./model-registry";

export async function updateTitle({
  messages,
  threadId,
  serverConvexClient,
}: {
  threadId: Id<"threads">;
  messages: ModelMessage[];
  serverConvexClient: ServerConvexClient;
}) {
  if (messages.length > 1 || !messages[0] || !threadId) return;
  console.debug("[Server] Updating thread title", threadId);

  const content = (messages[0].content as TextPart[])[0]?.text ?? "Empty message";

  const { text } = await generateText({
    model: registry("google/gemini-2.5-flash"),
    providerOptions: { google: { safetySettings } },
    messages: [
      {
        role: "system",
        content:
          "You are a conversational assistant and you need to summarize the user's text into a title of 10 words or less. Do not add anything else.",
      },
      {
        role: "user",
        content: dedent`
				User message content:
				"""
				${content}
				"""

				Please summarize the above conversation into a title, following the following rules.
				- The title must be 10 words or less.
				- The title must be without punctuation, prefix or any special characters.
				- The title must be short and descriptive.
				- The title must be in the same language as the user's text. (This does not apply when user asked to translate to another language, in that case, the title should be in the target language.)
				`.trim(),
      },
      {
        role: "assistant",
        content: "Title: ",
      },
    ],
  });

  await serverConvexClient.mutation(api.functions.threads.updateThreadTitle, {
    threadId,
    title: text.trim(),
  });
}
