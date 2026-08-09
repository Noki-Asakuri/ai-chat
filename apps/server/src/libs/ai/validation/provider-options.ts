import type { ReasoningEffort } from "@ai-chat/shared/chat/metadata";
import type { ModelData } from "@ai-chat/shared/chat/models";
import { safetySettings, type ChatRequestBody } from "@ai-chat/shared/chat/request";

import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";

import { webSearch } from "../tools/web-search";
import type { ChatProviderOptions } from "./types";

export function buildProviderOptions(modelInfo: ModelData, reasoning: ReasoningEffort): ChatProviderOptions {
  const reasoningProviderOptions: ChatProviderOptions = {
    openai: buildOpenAIProviderOptions(modelInfo),
    deepseek: {},
    google: { safetySettings },
    moonshotai:
      modelInfo.provider === "kimi" && modelInfo.capabilities.reasoning?.type === "selectable"
        ? { thinking: { type: reasoning === "none" ? "disabled" : "enabled" } }
        : {},
    zai:
      modelInfo.provider === "zai"
        ? { thinking: { type: reasoning === "none" ? "disabled" : "enabled" } }
        : {},
  };

  if (!modelInfo.modalities.output.includes("image") || modelInfo.provider !== "google") {
    return reasoningProviderOptions;
  }

  return {
    ...reasoningProviderOptions,
    google: buildGoogleImageProviderOptions(modelInfo),
  };
}

function buildOpenAIProviderOptions(modelInfo: ModelData): ChatProviderOptions["openai"] {
  if (!modelInfo.capabilities.reasoning) {
    return { store: false };
  }

  return {
    store: false,
    reasoningSummary: "detailed",
    include: ["reasoning.encrypted_content"],
  };
}

function buildGoogleImageProviderOptions(modelInfo: ModelData): ChatProviderOptions["google"] {
  if (modelInfo.id === "google/gemini-3-pro-image") {
    return {
      safetySettings,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { imageSize: "2K" },
    };
  }

  return { safetySettings, responseModalities: ["TEXT", "IMAGE"] };
}

export function buildTools(data: ChatRequestBody, modelInfo: ModelData): ToolSet {
  const webSearchTools: ToolSet = data.modelParams.webSearch ? buildWebSearchTools(modelInfo) : {};
  const imageTools: ToolSet = buildImageTools(modelInfo);

  return { ...webSearchTools, ...imageTools };
}

function buildWebSearchTools(modelInfo: ModelData): ToolSet {
  if (!modelInfo.capabilities.toolCalling) return {};

  return {
    web_search: webSearch,
  };
}

function buildImageTools(modelInfo: ModelData): ToolSet {
  if (
    !modelInfo.capabilities.toolCalling ||
    !modelInfo.capabilities.imageGeneration ||
    modelInfo.provider !== "openai"
  ) {
    return {};
  }

  return {
    image_generation: openai.tools.imageGeneration({ outputFormat: "webp", quality: "high" }),
  };
}
