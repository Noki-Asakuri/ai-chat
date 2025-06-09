import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { generateText } from "ai";

import { serverConvexClient } from "../convex/server";
import { registry } from "./model-registry";

export async function updateTitle(
  messages: { role: string; content: string }[],
  threadId: Id<"threads">,
) {
  if (messages.length > 1 || !messages[0] || !threadId) return;
  console.debug("[Server] Updating thread title", threadId);

  const { text } = await generateText({
    model: registry.languageModel("google/gemini-2.5-flash-preview-05-20"),
    providerOptions: {
      google: { thinkingConfig: { thinkingBudget: 0 } } satisfies GoogleGenerativeAIProviderOptions,
    },
    messages: [
      {
        role: "system",
        content:
          "You are a conversational assistant and you need to summarize the user's text into a title of 10 words or less.",
      },
      {
        role: "user",
        content: `User: ${messages[0].content}

Please summarize the above conversation into a title of 10 words or less, without punctuation.`,
      },
      {
        role: "assistant",
        content: "Title: ",
      },
    ],
  });

  await serverConvexClient.mutation(api.threads.updateThreadTitle, {
    threadId,
    title: text.trim(),
  });
}
