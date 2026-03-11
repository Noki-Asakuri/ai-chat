import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createProviderRegistry, customProvider, wrapLanguageModel } from "ai";

import { env } from "../env";

import { ModelsData } from "@/lib/chat/models";

const providerOptions = { baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY };

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
    "gemini-3.1-pro": baseGoogle.languageModel("gemini-3.1-pro-preview"),
    "gemini-3-pro-image": baseGoogle.languageModel("gemini-3-pro-image-preview"),
  },
});

const providers = createProviderRegistry({ google, openai, deepseek }, { separator: "/" });

function assertModelRegistryCoverage() {
  const missingRuntimeIds: Array<string> = [];

  for (const modelData of Object.values(ModelsData)) {
    const runtimeModelId = modelData.deprecation?.replacementModelId ?? modelData.id;

    try {
      providers.languageModel(runtimeModelId);
    } catch {
      missingRuntimeIds.push(runtimeModelId);
    }
  }

  if (missingRuntimeIds.length > 0) {
    throw new Error(`Model registry missing runtime ids: ${missingRuntimeIds.join(", ")}`);
  }
}

assertModelRegistryCoverage();

export const registry: typeof providers.languageModel = (...args) => {
  const middleware = env.NODE_ENV === "development" ? [devToolsMiddleware()] : [];

  return wrapLanguageModel({
    model: providers.languageModel(...args),
    middleware,
  });
};
