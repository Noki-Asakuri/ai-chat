import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import { createProviderRegistry, customProvider } from "ai";

import { env } from "@/env";

const providerOptions = { baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY };

const baseOpenai = createOpenAI(providerOptions);
const deepseek = createDeepSeek(providerOptions);
const baseGoogle = createGoogleGenerativeAI({
  ...providerOptions,
  baseURL: env.PROXY_URL + "/v1beta/",
});

const openai = customProvider({
  languageModels: {
    "gpt-4.1": baseOpenai.chat("gpt-4.1"),

    "gpt-4o": baseOpenai.chat("gpt-4o"),
    "chatgpt-4o": baseOpenai.chat("chatgpt-4o-latest"),

    o3: baseOpenai.chat("o3"),
    "o3-mini": baseOpenai.chat("o3-mini"),
    "o4-mini": baseOpenai.chat("o4-mini"),
  },
  fallbackProvider: baseOpenai,
});

const google = customProvider({
  languageModels: {
    "gemini-2.5-flash": baseGoogle.languageModel("gemini-2.5-flash"),
    "gemini-2.5-flash-thinking": baseGoogle.languageModel("gemini-2.5-flash"),

    "gemini-2.5-flash-lite": baseGoogle.languageModel("gemini-2.5-flash-lite"),
    "gemini-2.5-flash-lite-thinking": baseGoogle.languageModel("gemini-2.5-flash-lite"),

    "gemini-2.5-pro": baseGoogle.languageModel("gemini-2.5-pro"),
  },
  fallbackProvider: baseGoogle,
});

export const registry = createProviderRegistry(
  {
    google,
    openai,
    deepseek,
  },
  { separator: "/" },
);
