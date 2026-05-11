import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { generateText, type ModelMessage } from "ai";
import { ConvexHttpClient } from "convex/browser";
import dedent from "dedent";

import { registry } from "../registry";
import { logger } from "@/libs/axiom";

export async function generateNewThreadTitleAndSave(
  convexClient: ConvexHttpClient,
  options: { threadId: Id<"threads">; modelMessages: ModelMessage[] },
) {
  if (!options.modelMessages[0]) return;

  logger.debug("[Server] Updating thread title", options.threadId);
  const content = extractUserMessage(options.modelMessages[0]);

  const { text } = await generateText({
    model: registry("openai/gpt-5.4-mini"),
    providerOptions: { openai: { reasoningEffort: "low" } },

    system:
      "You are a conversational assistant and you need to summarize the user's text into a title of 10 words or less. Do not add anything else.",
    messages: [
      {
        role: "user",
        content: dedent`
				User message content:

				"""
				${content}
				"""

				Please summarize the above conversation into a title, following the following rules:
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

  return convexClient.mutation(api.functions.threads.updateThreadTitle, {
    threadId: options.threadId,
    title: text.trim(),
  });
}

function extractUserMessage(message: ModelMessage) {
  if (typeof message.content === "string") return message.content;

  const textParts = message.content.filter((part) => part.type === "text");
  if (!textParts.length) return "Empty Message";

  return textParts.map((part) => part.text).join("\n\n");
}
