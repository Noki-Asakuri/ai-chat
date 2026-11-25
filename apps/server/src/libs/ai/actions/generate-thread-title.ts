import { DEFAULT_GENERAL_SETTINGS } from "@ai-chat/shared/chat/preferences";
import { resolveModel, resolveReasoning } from "@ai-chat/shared/chat/models";
import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import dedent from "dedent";

import { getThreadTitleInput } from "./thread-title-input";

import { logger } from "../../axiom";
import { getLanguageModel } from "../registry";
import { buildProviderOptions } from "../validation/provider-options";

/**
 * Titles a thread from its first user message as stored. The request only carries chip labels as plain text,
 * so the stored markup is what tells a message of only `@` file chips apart from typed text.
 */
export async function generateNewThreadTitleAndSave(
  convexClient: ConvexHttpClient,
  options: { threadId: Id<"threads"> },
) {
  const messages = await convexClient.query(api.functions.messages.getAllMessagesWithoutAttachments, {
    threadId: options.threadId,
  });
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return;

  await generateThreadTitleFromPartsAndSave(convexClient, {
    threadId: options.threadId,
    parts: firstUser.parts,
  });
}

export async function generateThreadTitleFromPartsAndSave(
  convexClient: ConvexHttpClient,
  options: { threadId: Id<"threads">; parts: Parameters<typeof getThreadTitleInput>[0] },
) {
  logger.debug("[Server] Updating thread title", { threadId: options.threadId });
  const titleInput = getThreadTitleInput(options.parts);

  // Nothing to summarize when the message is only attachments; name it after them instead.
  if (titleInput.kind === "fixed") {
    await convexClient.mutation(api.functions.threads.updateThreadTitle, {
      threadId: options.threadId,
      title: titleInput.title,
    });
    return;
  }

  const content = titleInput.text;

  const preferences = await convexClient.query(api.functions.users.getCurrentUserPreferences, {});
  let config = preferences.textGeneration ?? DEFAULT_GENERAL_SETTINGS.textGeneration;
  let resolvedModel = resolveModel(config.model);
  // Previously saved image-output models must not generate images for titles.
  if (
    resolvedModel.data.modalities.output.length !== 1 ||
    resolvedModel.data.modalities.output[0] !== "text"
  ) {
    config = DEFAULT_GENERAL_SETTINGS.textGeneration;
    resolvedModel = resolveModel(config.model);
  }
  const { requestedId, data: model } = resolvedModel;
  const effort = resolveReasoning(model, config.effort);

  const { text } = await generateText({
    reasoning:
      model.provider === "kimi" ||
      model.provider === "zai" ||
      effort === "max" ||
      model.capabilities.reasoning?.type !== "selectable"
        ? undefined
        : effort,
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
