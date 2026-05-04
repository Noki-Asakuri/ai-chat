import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { webSearch } from "@exalabs/ai-sdk";
import type { ToolSet } from "ai";

import type { ReasoningEffort } from "@ai-chat/shared/chat/metadata";
import type { ModelData, Provider } from "@ai-chat/shared/chat/models";
import { safetySettings, type ChatRequestBody } from "@ai-chat/shared/chat/request";

import type { ChatProviderOptions } from "./types";

const reasoningMapping = {
  kimi: {
    budget: { none: 1_024, minimal: 1_024, low: 2_048, medium: 4_096, high: 8_192, xhigh: 8_192 },
  },
  google: {
    budget: { none: 0, minimal: 128, low: 1_024, medium: 10_000, high: 20_000, xhigh: 30_000 },
    effort: {
      none: "minimal",
      minimal: "minimal",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "high",
    },
    effort31: {
      none: "low",
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "high",
    },
  },
  zai: {},
  openai: {},
  deepseek: {},
} satisfies Record<Provider, Record<string, Record<ReasoningEffort, number | ReasoningEffort>>>;

export function buildProviderOptions(input: {
  modelInfo: ModelData;
  requestedId: string;
  effort: ReasoningEffort;
}): ChatProviderOptions {
  const { modelInfo, effort } = input;
  const reasoningEnabled = Boolean(modelInfo.capabilities.reasoning) && effort !== "none";
  const reasoningProviderOptions: ChatProviderOptions = {
    openai: buildOpenAIProviderOptions(input),
    google: {
      safetySettings,
      thinkingConfig: buildGoogleThinkingConfig(input),
    },
    kimi: {
      thinking: {
        type: reasoningEnabled ? "enabled" : "disabled",
        budgetTokens: modelInfo.capabilities.reasoning ? reasoningMapping.kimi.budget[effort] : 1024,
      },
    },
    zai: { thinking: { type: reasoningEnabled ? "enabled" : "disabled" } },
  };

  if (!modelInfo.capabilities.generateImage || modelInfo.provider !== "google") {
    return reasoningProviderOptions;
  }

  return {
    ...reasoningProviderOptions,
    google: buildGoogleImageProviderOptions(modelInfo),
  };
}

function buildOpenAIProviderOptions(input: {
  modelInfo: ModelData;
  effort: ReasoningEffort;
}): ChatProviderOptions["openai"] {
  if (!input.modelInfo.capabilities.reasoning) {
    return { store: false };
  }

  return {
    store: false,
    reasoningEffort: input.effort,
    reasoningSummary: "detailed",
    include: ["reasoning.encrypted_content"],
  };
}

function buildGoogleThinkingConfig(input: {
  modelInfo: ModelData;
  requestedId: string;
  effort: ReasoningEffort;
}): NonNullable<GoogleGenerativeAIProviderOptions["thinkingConfig"]> {
  const { modelInfo, requestedId, effort } = input;

  if (!modelInfo.capabilities.reasoning) {
    return { includeThoughts: false, thinkingBudget: 0 };
  }

  if (requestedId === "google/gemini-3-flash-thinking") {
    return { includeThoughts: true, thinkingLevel: "minimal" };
  }

  if (modelInfo.id === "google/gemini-3-pro") {
    return { includeThoughts: true, thinkingLevel: reasoningMapping.google.effort[effort] };
  }

  if (modelInfo.id === "google/gemini-3.1-pro") {
    return { includeThoughts: true, thinkingLevel: reasoningMapping.google.effort31[effort] };
  }

  return { includeThoughts: true, thinkingBudget: getGoogleThinkingBudget(modelInfo, effort) };
}

function getGoogleThinkingBudget(modelInfo: ModelData, effort: ReasoningEffort): number {
  const configuredBudget = reasoningMapping.google.budget[effort];

  if (modelInfo.id !== "google/gemini-2.5-pro") return configuredBudget;
  if (configuredBudget !== 0) return configuredBudget;

  return -1;
}

function buildGoogleImageProviderOptions(modelInfo: ModelData): ChatProviderOptions["google"] {
  if (modelInfo.id === "google/gemini-3-pro-image") {
    return {
      safetySettings,
      responseModalities: ["IMAGE"],
      imageConfig: { imageSize: "2K" },
    };
  }

  return { safetySettings, responseModalities: ["IMAGE"] };
}

export function buildTools(data: ChatRequestBody, modelInfo: ModelData): ToolSet {
  const webSearchTools: ToolSet = data.modelParams.webSearch
    ? buildWebSearchTools(modelInfo)
    : {};
  const imageTools: ToolSet = buildImageTools(modelInfo);

  return { ...webSearchTools, ...imageTools };
}

function buildWebSearchTools(modelInfo: ModelData): ToolSet {
  if (!modelInfo.capabilities.webSearch) return {};

  return {
    web_search: webSearch({
      numResults: 10,
      contents: { text: { maxCharacters: 1500 }, livecrawlTimeout: 10000 },
    }),
  };
}

function buildImageTools(modelInfo: ModelData): ToolSet {
  if (!modelInfo.capabilities.generateImage || modelInfo.provider !== "openai") {
    return {};
  }

  return {
    image_generation: openai.tools.imageGeneration({
      outputFormat: "webp",
      quality: "high",
    }),
  };
}
