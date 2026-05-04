import { generateText } from "ai";
import dedent from "dedent";

import { registry } from "../registry";

export async function generateThreadTitle({ content }: { content: string }) {
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

  return text.trim();
}
