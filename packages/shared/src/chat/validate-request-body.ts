import { type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { webSearch } from "@exalabs/ai-sdk";
import { convertToModelMessages, validateUIMessages, type ToolSet } from "ai";
import { z } from "zod/v4";

import { RequestValidationError, type DeprecatedModelErrorDetails } from "./errors";
import { metadataSchema, type ReasoningEffort, type UIChatMessage } from "./metadata";
import { getModelData, resolveModel } from "./models";
import { chatRequestBodySchema, safetySettings, type ChatRequestBody } from "./request";
import { reasoningEffortSchema } from "./metadata";
import { tryCatch, tryCatchSync } from "../utils/async";
import type { MoonshotAIProviderOptions } from "@ai-sdk/moonshotai";

export { RequestValidationError, safetySettings };

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
  const out: Array<UIChatMessage> = messages.slice();

  type Part = UIChatMessage["parts"][number];

  for (let i = 0; i < out.length; i++) {
    const message = out[i];
    if (!message || message.role !== "assistant") continue;

    const fileParts: Array<Part> = [];
    const nonFileParts: Array<Part> = [];

    for (const part of message.parts) {
      if (part.type === "file") fileParts.push(part);
      else nonFileParts.push(part);
    }

    if (fileParts.length === 0) continue;

    out[i] = { ...message, parts: nonFileParts };

    const next = out[i + 1];
    if (next?.role === "user") {
      out[i + 1] = { ...next, parts: [...next.parts, ...fileParts] };
    }
  }

  return out;
}

export function createChatRequestValidator<
  TAssistantMessageIdSchema extends z.ZodTypeAny,
  TThreadIdSchema extends z.ZodTypeAny,
  TProfileIdSchema extends z.ZodTypeAny,
>(schemas: {
  assistantMessageIdSchema: TAssistantMessageIdSchema;
  threadIdSchema: TThreadIdSchema;
  profileIdSchema: TProfileIdSchema;
}) {
  const inputSchema = chatRequestBodySchema.extend({
    assistantMessageId: schemas.assistantMessageIdSchema,
    threadId: schemas.threadIdSchema,
    modelParams: chatRequestBodySchema.shape.modelParams.extend({
      effort: reasoningEffortSchema,
      profile: schemas.profileIdSchema.nullish().default(null),
    }),
  });

  async function validateRequestBody(body: Record<string, unknown>) {
    const parsed = inputSchema.safeParse(body);
    const { success, error } = parsed;
    if (!success) throw new Error(z.prettifyError(error));

    const data = parsed.data as ChatRequestBody & {
      assistantMessageId: z.infer<TAssistantMessageIdSchema>;
      threadId: z.infer<TThreadIdSchema>;
      modelParams: ChatRequestBody["modelParams"] & {
        profile: z.infer<TProfileIdSchema> | null;
      };
    };

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

    if (modelError) {
      throw new Error(`Invalid model: ${modelError.message}`, { cause: modelError });
    }

    const tools: ToolSet = {};
    const { data: modelInfo, requestedId } = resolvedModel;

    if (modelInfo.deprecation) {
      const replacementModel = getModelData(modelInfo.deprecation.replacementModelId);

      const details: DeprecatedModelErrorDetails = {
        modelId: requestedId,
        modelName: modelInfo.display.unique ?? modelInfo.display.name,
        replacementModelId: modelInfo.deprecation.replacementModelId,
        replacementModelName: replacementModel.display.unique ?? replacementModel.display.name,
      };

      throw new RequestValidationError({
        code: "MODEL_DEPRECATED",
        message: modelInfo.deprecation.message,
        details,
      });
    }

    const modelMessages = await convertToModelMessages(normalizedMessages);

    const providerOptions = {
      openai: { store: false } as OpenAIResponsesProviderOptions,
      google: { safetySettings } as GoogleGenerativeAIProviderOptions,
      kimi: {} as MoonshotAIProviderOptions,
      zai: {} as Exclude<MoonshotAIProviderOptions, "reasoningHistory">,
    };

    providerOptions.google.thinkingConfig = {
      includeThoughts: Boolean(modelInfo.capabilities.reasoning),
      thinkingBudget: 0,
    };

    if (modelInfo.capabilities.reasoning) {
      const effort = data.modelParams.effort ?? "medium";

      providerOptions.openai.reasoningEffort = effort;
      providerOptions.openai.reasoningSummary = "detailed";
      providerOptions.openai.include = ["reasoning.encrypted_content"];

      providerOptions.google.thinkingConfig.thinkingBudget =
        reasoningToBudget[effort] ?? reasoningToBudget.medium;

      // Disable thinking if effort is set to 'none' for Kimi K2.5
      if (modelInfo.provider === "kimi" && modelInfo.id === "kimi/kimi-k2.5" && effort === "none") {
        providerOptions.kimi.thinking = { type: "disabled" };
      }

      if (modelInfo.provider === "zai" && effort === "none") {
        providerOptions.zai.thinking = { type: "disabled" };
      }

      if (modelInfo.id === "google/gemini-2.5-pro") {
        providerOptions.google.thinkingConfig.thinkingBudget =
          providerOptions.google.thinkingConfig.thinkingBudget === 0
            ? -1
            : providerOptions.google.thinkingConfig.thinkingBudget;
      }

      if (requestedId === "google/gemini-3-flash-thinking") {
        providerOptions.google.thinkingConfig = {
          includeThoughts: true,
          thinkingLevel: "minimal",
        };
      }

      if (modelInfo.id === "google/gemini-3-pro") {
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

    if (data.modelParams.webSearch && modelInfo.capabilities.webSearch) {
      tools.web_search = webSearch({
        type: "auto",
        numResults: 10,
        contents: {
          text: { maxCharacters: 1500 },
          livecrawl: "fallback",
          livecrawlTimeout: 10000,
        },
      });
    }

    switch (modelInfo.provider) {
      case "google":
        if (modelInfo.capabilities.generateImage) {
          delete providerOptions.google.thinkingConfig;
          providerOptions.google.responseModalities = ["IMAGE"];

          if (modelInfo.id === "google/gemini-3-pro-image") {
            providerOptions.google.imageConfig = { imageSize: "2K" };
          }
        }
        break;

      case "openai":
        if (modelInfo.capabilities.generateImage) {
          tools.image_generation = openai.tools.imageGeneration({
            outputFormat: "webp",
            quality: "high",
          });
        }
        break;
    }

    return {
      messages: normalizedMessages,
      modelMessages,
      assistantMessageId: data.assistantMessageId,
      threadId: data.threadId,
      streamId: data.streamId,
      modelParams: data.modelParams,
      model: { id: modelInfo.id, uniqueId: requestedId },
      providerOptions,
      tools,
    };
  }

  return {
    inputSchema,
    validateRequestBody,
    assistantMessageIdSchema: schemas.assistantMessageIdSchema,
    threadIdSchema: schemas.threadIdSchema,
    profileIdSchema: schemas.profileIdSchema,
  };
}

export type { ChatRequestBody, DeprecatedModelErrorDetails };
