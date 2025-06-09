import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import { createProviderRegistry } from "ai";

import { env } from "@/env";

const providerOptions = { baseURL: env.PROXY_URL, apiKey: env.PROXY_KEY };

const openai = createOpenAI(providerOptions);
const deepseek = createDeepSeek(providerOptions);
const google = createGoogleGenerativeAI({
  ...providerOptions,
  baseURL: env.PROXY_URL + "/v1beta/",
});

export const registry = createProviderRegistry({ google, openai, deepseek }, { separator: "/" });
