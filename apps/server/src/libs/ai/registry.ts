import { getModelData, type ModelIdKey } from "@ai-chat/shared/chat/models";

import type { LanguageModel } from "ai";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { env } from "@/env";

const providerOptions = { baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY };

const deepseek = createDeepSeek(providerOptions);
const google = createGoogle({ ...providerOptions, baseURL: `${providerOptions.baseURL}/v1beta/` });
const kimi = createMoonshotAI(providerOptions);
const openai = createOpenAI(providerOptions);
const zai = createOpenAICompatible({ ...providerOptions, name: "zai", includeUsage: true });

export function getLanguageModel(modelId: ModelIdKey): LanguageModel {
  const model = getModelData(modelId);
  const runtimeModelId = model.runtime?.modelId ?? model.id.slice(model.id.indexOf("/") + 1);

  switch (model.provider) {
    case "deepseek":
      return deepseek.languageModel(runtimeModelId);
    case "google":
      return google.languageModel(runtimeModelId);
    case "kimi":
      return kimi.languageModel(runtimeModelId);
    case "openai":
      return model.runtime?.api === "chat"
        ? openai.chat(runtimeModelId)
        : openai.languageModel(runtimeModelId);
    case "zai":
      return zai.languageModel(runtimeModelId);
  }
}
