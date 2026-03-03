import type { Id } from "@/convex/_generated/dataModel";

import { z } from "zod/v4";

import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { convertToModelMessages, validateUIMessages, type ToolSet } from "ai";

import { getModelData, resolveModel } from "../chat/models";
import { metadataSchema, type ReasoningEffort, type UIChatMessage } from "../types";
import { tryCatch, tryCatchSync } from "../utils";

type RequestValidationErrorCode = "MODEL_DEPRECATED";

export type DeprecatedModelErrorDetails = {
  modelId: string;
  modelName: string;
  replacementModelId: string;
  replacementModelName: string;
};

export class RequestValidationError extends Error {
  readonly code: RequestValidationErrorCode;
  readonly details: DeprecatedModelErrorDetails;

  constructor({
    code,
    message,
    details,
  }: {
    code: RequestValidationErrorCode;
    message: string;
    details: DeprecatedModelErrorDetails;
  }) {
    super(message);
    this.name = "RequestValidationError";
    this.code = code;
    this.details = details;
  }
}

export const threadIdSchema = z.custom<Id<"threads">>((data) => z.string().parse(data));
export const messageIdSchema = z.custom<Id<"messages">>((data) => z.string().parse(data));
export const attachmentIdSchema = z.custom<Id<"attachments">>((data) => z.string().parse(data));
export const profileIdSchema = z.custom<Id<"profiles">>((data) => z.string().parse(data));

export const inputSchema = z.object({
  assistantMessageId: messageIdSchema,
  threadId: threadIdSchema,
  messages: z.unknown().array(),

  model: z.string(),
  modelParams: z.object({
    webSearch: z.boolean().default(false),
    effort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]).default("medium"),
    profile: profileIdSchema.nullish().default(null),
  }),
});

export type ChatRequestBody = z.infer<typeof inputSchema>;

export const safetySettings = [
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HARASSMENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_HATE_SPEECH" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
  { threshold: "BLOCK_NONE", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
];

const reasoningToBudget: Record<ReasoningEffort, number> = {
  none: 0,
  minimal: 128,
  low: 1_024,
  medium: 10_000,
  high: 20_000,
  xhigh: 30_000,
};

const openaiReasoningToGoogle: Record<ReasoningEffort, "minimal" | "low" | "medium" | "high"> = {
  none: "minimal",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "high",
};

const openaiReasoningToGoogle31: Record<ReasoningEffort, "low" | "medium" | "high"> = {
  none: "low",
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "high",
};

function moveAssistantFilePartsToNextUserMessageValidated(
  messages: Array<UIChatMessage>,
): Array<UIChatMessage> {
  // Only run after validateUIMessages, so we can treat messages/parts as trusted UIMessage objects.
  // Expected order: user -> assistant -> user (repeat).
  const out: Array<UIChatMessage> = messages.slice();

  type Part = UIChatMessage["parts"][number];

  for (let i = 0; i < out.length; i++) {
    const message = out[i];
    if (!message) continue;
    if (message.role !== "assistant") continue;

    const fileParts: Array<Part> = [];
    const nonFileParts: Array<Part> = [];

    for (const part of message.parts) {
      if (part.type === "file") fileParts.push(part);
      else nonFileParts.push(part);
    }

    if (fileParts.length === 0) continue;

    // Strip file parts from assistant message
    out[i] = { ...message, parts: nonFileParts };

    // Move them onto the next user message (new user turn)
    const next = out[i + 1];
    if (!next) continue;
    if (next.role === "user") {
      out[i + 1] = { ...next, parts: [...next.parts, ...fileParts] };
    }
  }

  return out;
}

export async function validateRequestBody(body: Record<string, unknown>) {
  const { success, data, error } = inputSchema.safeParse(body);
  if (!success) throw new Error(z.prettifyError(error));

  const [validatedMessages, messagesError] = await tryCatch(
    validateUIMessages<UIChatMessage>({ messages: data.messages, metadataSchema }),
  );

  if (messagesError) {
    throw new Error(`Invalid messages format: ${messagesError.message}`, {
      cause: messagesError,
    });
  }

  const normalizedMessages = moveAssistantFilePartsToNextUserMessageValidated(validatedMessages);

  const [resolvedModel, modelError] = tryCatchSync(() => {
    if (!data.model || data.model.length === 0) throw new Error("No model provided");
    return resolveModel(data.model);
  });

  if (modelError) throw new Error(`Invalid model: ${modelError.message}`, { cause: modelError });

  const tools: ToolSet = {};
  const { data: modelInfo, requestedId } = resolvedModel;

  if (modelInfo.deprecation) {
    const replacementModel = getModelData(modelInfo.deprecation.replacementModelId);

    throw new RequestValidationError({
      code: "MODEL_DEPRECATED",
      message: modelInfo.deprecation.message,
      details: {
        modelId: requestedId,
        modelName: modelInfo.display.unique ?? modelInfo.display.name,
        replacementModelId: modelInfo.deprecation.replacementModelId,
        replacementModelName: replacementModel.display.unique ?? replacementModel.display.name,
      },
    });
  }

  const modelMessages = await convertToModelMessages(normalizedMessages);

  const providerOptions = {
    openai: { store: false } as OpenAIResponsesProviderOptions,
    google: { safetySettings } as GoogleGenerativeAIProviderOptions,
  };

  providerOptions.google.thinkingConfig = {
    includeThoughts: !!modelInfo.capabilities.reasoning,
    thinkingBudget: 0,
  };

  if (modelInfo.capabilities.reasoning) {
    const effort = data.modelParams.effort ?? "medium";

    providerOptions.openai.reasoningEffort = effort;
    providerOptions.openai.reasoningSummary = "detailed";
    providerOptions.openai.include = ["reasoning.encrypted_content"];

    providerOptions.google.thinkingConfig.thinkingBudget =
      reasoningToBudget[effort] ?? reasoningToBudget.medium;

    if (modelInfo.id === "google/gemini-2.5-pro") {
      // Gemini 2.5 Pro doesn't disable thinking, so we fallback to dynamic mode.
      providerOptions.google.thinkingConfig.thinkingBudget =
        providerOptions.google.thinkingConfig.thinkingBudget === 0
          ? -1
          : providerOptions.google.thinkingConfig.thinkingBudget;
    }

    if (requestedId === "google/gemini-3-flash-thinking") {
      // We disable thinking on normal gemini-3-flash. For thinking, we use gemini-3-flash-thinking.
      providerOptions.google.thinkingConfig = { includeThoughts: true, thinkingLevel: "minimal" };
    }

    if (modelInfo.id === "google/gemini-3-pro") {
      // Right now it doesn't support thinking budget.
      providerOptions.google.thinkingConfig = {
        includeThoughts: true,
        thinkingLevel: openaiReasoningToGoogle[effort],
      };
    }

    if (modelInfo.id === "google/gemini-3.1-pro") {
      providerOptions.google.thinkingConfig = {
        includeThoughts: true,
        thinkingLevel: openaiReasoningToGoogle31[effort],
      };
    }
  }

  switch (modelInfo.provider) {
    case "google":
      if (modelInfo.capabilities.generateImage) {
        delete providerOptions.google.thinkingConfig;
        providerOptions.google.responseModalities = ["TEXT", "IMAGE"];

        // Only gemini-3-pro-image supports setting image size.
        if (modelInfo.id === "google/gemini-3-pro-image") {
          providerOptions.google.imageConfig = { imageSize: "2K" };
        }
      }

      if (data.modelParams.webSearch && modelInfo.capabilities.webSearch) {
        tools.url_context = google.tools.urlContext({});
        tools.google_search = google.tools.googleSearch({});
      }
      break;

    case "openai":
      if (modelInfo.capabilities.generateImage) {
        tools.image_generation = openai.tools.imageGeneration({
          outputFormat: "webp",
          quality: "high",
        });
      }

      if (data.modelParams.webSearch && modelInfo.capabilities.webSearch) {
        tools.web_search = openai.tools.webSearch({});
      }
      break;
  }

  return {
    messages: normalizedMessages,
    modelMessages,
    assistantMessageId: data.assistantMessageId,
    threadId: data.threadId,
    modelParams: data.modelParams,
    model: { id: modelInfo.id, uniqueId: requestedId },
    providerOptions,
    tools,
  };
}
