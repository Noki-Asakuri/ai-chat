import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { generateText } from "ai";

import { type ServerConvexClient } from "../convex/server";
import { registry } from "./model-registry";
import dedent from "dedent";

export async function updateTitle({
  messages,
  threadId,
  serverConvexClient,
}: {
  threadId: Id<"threads">;
  messages: { role: string; content: string }[];
  serverConvexClient: ServerConvexClient;
}) {
  if (messages.length > 1 || !messages[0] || !threadId) return;
  console.debug("[Server] Updating thread title", threadId);

  const { text } = await generateText({
    model: registry.languageModel("google/gemini-2.5-flash"),
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
        content: dedent`
				User: ${messages[0].content}

				Please summarize the above conversation into a title, following the following rules.
				- The title must be 10 words or less.
				- The title must be without punctuation, prefix or any special characters.
				- The title must be short and descriptive.
				- The title must be in the same language as the user's text.
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
