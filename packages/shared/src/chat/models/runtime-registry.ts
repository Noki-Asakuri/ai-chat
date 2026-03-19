import { createDeepSeek } from "@ai-sdk/deepseek";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, customProvider, wrapLanguageModel } from "ai";

import { type ModelIdKey, ModelsData } from "./index";

export type CreateModelRegistryOptions = {
  proxyUrl: string;
  proxyKey: string;
  isDevelopment: boolean;
};

export function createModelRegistry(options: CreateModelRegistryOptions) {
  const providerOptions = { baseURL: options.proxyUrl, apiKey: options.proxyKey };

  const deepseek = createDeepSeek(providerOptions);
  const baseOpenai = createOpenAI(providerOptions);
  const baseGoogle = createGoogleGenerativeAI({
    ...providerOptions,
    baseURL: providerOptions.baseURL + "/v1beta/",
  });

  const openai = customProvider({
    languageModels: {
      "gpt-4.1": baseOpenai.chat("gpt-4.1"),

      "gpt-4o": baseOpenai.chat("gpt-4o"),
      "chatgpt-4o": baseOpenai.chat("chatgpt-4o-latest"),

      o3: baseOpenai.languageModel("o3"),
      "o3-mini": baseOpenai.languageModel("o3-mini"),
      "o4-mini": baseOpenai.languageModel("o4-mini"),

      "gpt-5": baseOpenai.languageModel("gpt-5"),
      "gpt-5-mini": baseOpenai.languageModel("gpt-5-mini"),
      "gpt-5-nano": baseOpenai.languageModel("gpt-5-nano"),
      "gpt-5-chat": baseOpenai.languageModel("gpt-5-chat-latest"),
      "gpt-5-codex": baseOpenai.languageModel("gpt-5-codex"),
      "gpt-5-pro": baseOpenai.languageModel("gpt-5-pro"),

      "gpt-5.1": baseOpenai.languageModel("gpt-5.1"),
      "gpt-5.1-chat": baseOpenai.languageModel("gpt-5.1-chat-latest"),
      "gpt-5.1-codex": baseOpenai.languageModel("gpt-5.1-codex"),
      "gpt-5.1-codex-mini": baseOpenai.languageModel("gpt-5.1-codex-mini"),

      "gpt-5.2": baseOpenai.languageModel("gpt-5.2"),
      "gpt-5.2-chat": baseOpenai.languageModel("gpt-5.2-chat-latest"),
      "gpt-5.2-codex": baseOpenai.languageModel("gpt-5.2-codex"),
      "gpt-5.2-pro": baseOpenai.languageModel("gpt-5.2-pro"),

      "gpt-5.3-chat": baseOpenai.languageModel("gpt-5.3-chat-latest"),
      "gpt-5.3-codex": baseOpenai.languageModel("gpt-5.3-codex"),

      "gpt-5.4": baseOpenai.languageModel("gpt-5.4"),
      "gpt-5.4-pro": baseOpenai.languageModel("gpt-5.4-pro"),
      "gpt-5.4-mini": baseOpenai.languageModel("gpt-5.4-mini"),
      "gpt-5.4-nano": baseOpenai.languageModel("gpt-5.4-nano"),
    },
  });

  const google = customProvider({
    languageModels: {
      "gemini-2.5-flash-lite": baseGoogle.languageModel("gemini-2.5-flash-lite"),
      "gemini-2.5-flash-lite-thinking": baseGoogle.languageModel("gemini-2.5-flash-lite"),

      "gemini-2.5-flash": baseGoogle.languageModel("gemini-2.5-flash"),
      "gemini-2.5-flash-thinking": baseGoogle.languageModel("gemini-2.5-flash"),
      "gemini-2.5-flash-image": baseGoogle.languageModel("gemini-2.5-flash-image"),

      "gemini-2.5-pro": baseGoogle.languageModel("gemini-2.5-pro"),

      "gemini-3-flash": baseGoogle.languageModel("gemini-3-flash-preview"),
      "gemini-3-flash-thinking": baseGoogle.languageModel("gemini-3-flash-preview"),

      "gemini-3-pro": baseGoogle.languageModel("gemini-3-pro-preview"),
      "gemini-3-pro-image": baseGoogle.languageModel("gemini-3-pro-image-preview"),

      "gemini-3.1-pro": baseGoogle.languageModel("gemini-3.1-pro-preview"),
      "gemini-3.1-flash-image": baseGoogle.languageModel("gemini-3.1-flash-image-preview"),
    },
  });

  const providers = createProviderRegistry({ google, openai, deepseek }, { separator: "/" });

  assertModelRegistryCoverage(function languageModel(modelId: ModelIdKey) {
    return providers.languageModel(modelId);
  });

  const registry: typeof providers.languageModel = (...args) => {
    const middleware = options.isDevelopment ? [devToolsMiddleware()] : [];

    return wrapLanguageModel({
      model: providers.languageModel(...args),
      middleware,
    });
  };

  return registry;
}

function assertModelRegistryCoverage(languageModel: (modelId: ModelIdKey) => unknown) {
  const missingRuntimeIds: Array<string> = [];

  for (const modelData of Object.values(ModelsData)) {
    const runtimeModelId = modelData.deprecation?.replacementModelId ?? modelData.id;

    try {
      languageModel(runtimeModelId);
    } catch {
      missingRuntimeIds.push(runtimeModelId);
    }
  }

  if (missingRuntimeIds.length > 0) {
    throw new Error(`Model registry missing runtime ids: ${missingRuntimeIds.join(", ")}`);
  }
}
