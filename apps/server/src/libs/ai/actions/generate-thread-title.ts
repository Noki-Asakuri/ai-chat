import { DEFAULT_GENERAL_SETTINGS } from "@ai-chat/shared/chat/preferences";
import { resolveModel, resolveReasoning } from "@ai-chat/shared/chat/models";
import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { generateText, type ModelMessage } from "ai";
import { ConvexHttpClient } from "convex/browser";
import dedent from "dedent";

import { logger } from "../../axiom";
import { getLanguageModel } from "../registry";
import { buildProviderOptions } from "../validation/provider-options";

export async function generateNewThreadTitleAndSave(
  convexClient: ConvexHttpClient,
  options: { threadId: Id<"threads">; modelMessages: ModelMessage[] },
) {
  if (!options.modelMessages[0]) return;

  logger.debug("[Server] Updating thread title", { threadId: options.threadId });
  const content = extractUserMessage(options.modelMessages[0]);

  // Nothing to summarize when the message is only attachments; name it after them instead.
  if (content === null) {
    await convexClient.mutation(api.functions.threads.updateThreadTitle, {
      threadId: options.threadId,
      title: getAttachmentOnlyTitle(options.modelMessages[0]),
    });
    return;
  }

  const preferences = await convexClient.query(api.functions.users.getCurrentUserPreferences, {});
  let config = preferences.textGeneration ?? DEFAULT_GENERAL_SETTINGS.textGeneration;
  let resolvedModel = resolveModel(config.model);
  // Previously saved image-output models must not generate images for titles.
  if (resolvedModel.data.modalities.output.length !== 1 || resolvedModel.data.modalities.output[0] !== "text") {
    config = DEFAULT_GENERAL_SETTINGS.textGeneration;
    resolvedModel = resolveModel(config.model);
  }
  const { requestedId, data: model } = resolvedModel;
  const effort = resolveReasoning(model, config.effort);

  const { text } = await generateText({
    reasoning: model.provider === "kimi" || model.provider === "zai" || effort === "max" || model.capabilities.reasoning?.type !== "selectable" ? undefined : effort,
    providerOptions: buildProviderOptions(model, effort),
    model: getLanguageModel(requestedId),

    instructions:
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

  await convexClient.mutation(api.functions.threads.updateThreadTitle, {
    threadId: options.threadId,
    title: text.trim(),
  });
}

function extractUserMessage(message: ModelMessage): string | null {
  if (!Array.isArray(message.content)) return message.content.trim() || null;

  const text = message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");

  return text || null;
}

function getAttachmentOnlyTitle(message: ModelMessage): string {
  if (!Array.isArray(message.content)) return "New Chat";

  const isImage = (part: (typeof message.content)[number]) =>
    part.type === "image" || (part.type === "file" && part.mediaType.startsWith("image/"));
  const files = message.content.filter((part) => part.type === "image" || part.type === "file");

  if (files.length === 0) return "New Chat";
  if (files.every(isImage)) return files.length === 1 ? "Shared image" : "Shared images";
  return files.length === 1 ? "Shared file" : "Shared files";
}
