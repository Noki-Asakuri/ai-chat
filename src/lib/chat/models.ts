export function getModelData(modelId: AllModelIds | (string & {})): ModelData {
  const data = ModelsData[modelId as AllModelIds];
  if (data) return data;

  for (const id of AllModelIds) {
    const data = ModelsData[id] as ModelData;
    if (data.altModelIds?.some((id) => id === modelId)) return data;
  }

  throw new Error(`Unknown model: ${modelId}`);
}

export function prettifyProviderName(provider: Provider | (string & {})) {
  switch (provider) {
    case "google":
      return "Gemini";
    case "openai":
      return "OpenAI";
    case "deepseek":
      return "DeepSeek";
    default:
      return "Unknown";
  }
}

type Capability = {
  webSearch?: boolean;
  generateImage?: boolean;
  vision?: boolean;

  reasoning?: "budget" | "effort" | "always" | false;
  budgetLimit?: { min: number; max: number };

  maxTokens: number;
};
export type Provider = "google" | "openai" | "deepseek";
export type ModelData = {
  display: { unique?: string; name: string };
  id: ModelIdKey;
  altModelIds?: string[];
  provider: Provider;
  capabilities: Capability;
};

export type AllModelIds = keyof typeof ModelsData;
export type ModelIdKey = `${Provider}/${string}`;

export const ModelsData = {
  "google/gemini-2.5-flash-lite": {
    display: { name: "Gemini 2.5 Flash Lite" },
    id: "google/gemini-2.5-flash-lite",
    altModelIds: ["google/gemini-2.5-flash-lite-preview-06-17"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,

      maxTokens: 64_000,
    },
  },
  "google/gemini-2.5-flash-lite-thinking": {
    display: { name: "Gemini 2.5 Flash Lite", unique: "Gemini 2.5 Flash Lite (Thinking)" },
    id: "google/gemini-2.5-flash-lite",
    altModelIds: ["google/gemini-2.5-flash-lite"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 512, max: 24_576 },
      maxTokens: 64_000,
    },
  },
  "google/gemini-2.5-flash": {
    display: { name: "Gemini 2.5 Flash" },
    id: "google/gemini-2.5-flash",
    altModelIds: ["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-flash"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,

      maxTokens: 65_536,
    },
  },
  "google/gemini-2.5-flash-thinking": {
    display: { name: "Gemini 2.5 Flash", unique: "Gemini 2.5 Flash (Thinking)" },
    id: "google/gemini-2.5-flash",
    altModelIds: ["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-flash"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 0, max: 24_576 },
      maxTokens: 65_536,
    },
  },
  "google/gemini-2.5-flash-image": {
    display: { name: "Gemini 2.5 Flash (Image)", unique: "Gemini 2.5 Flash (Image)" },
    id: "google/gemini-2.5-flash-image",
    altModelIds: ["google/gemini-2.5-flash-image-preview"],
    provider: "google",
    capabilities: {
      vision: true,
      generateImage: true,
      maxTokens: 32_768,
    },
  },
  "google/gemini-2.5-pro-thinking": {
    display: { name: "Gemini 2.5 Pro" },
    id: "google/gemini-2.5-pro",
    altModelIds: [
      "google/gemini-2.5-pro-preview-05-06",
      "google/gemini-2.5-pro-preview-06-05",
      "google/gemini-2.5-pro",
    ],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 128, max: 32_768 },
      maxTokens: 65_536,
    },
  },

  "deepseek/deepseek-chat": {
    display: { name: "DeepSeek V3" },
    id: "deepseek/deepseek-chat",
    provider: "deepseek",
    capabilities: {
      maxTokens: 8_192,
    },
  },
  "deepseek/deepseek-reasoner": {
    display: { name: "DeepSeek R1" },
    id: "deepseek/deepseek-reasoner",
    provider: "deepseek",
    capabilities: {
      reasoning: "always",
      maxTokens: 65_536,
    },
  },

  "openai/gpt-4.1": {
    display: { name: "GPT 4.1" },
    id: "openai/gpt-4.1",
    provider: "openai",
    capabilities: {
      vision: true,
      maxTokens: 32_768,
    },
  },
  "openai/chatgpt-4o": {
    display: { name: "ChatGPT 4o" },
    id: "openai/chatgpt-4o",
    provider: "openai",
    capabilities: {
      vision: true,
      maxTokens: 16_384,
    },
  },
  "openai/gpt-4o": {
    display: { name: "GPT 4o" },
    id: "openai/gpt-4o",
    provider: "openai",
    capabilities: {
      vision: true,
      maxTokens: 16_384,
    },
  },

  "openai/gpt-5": {
    display: { name: "GPT 5" },
    id: "openai/gpt-5",
    provider: "openai",
    capabilities: {
      reasoning: "effort",
      vision: true,
      maxTokens: 128_000,
    },
  },
  "openai/gpt-5-mini": {
    display: { name: "GPT 5 Mini" },
    id: "openai/gpt-5-mini",
    provider: "openai",
    capabilities: {
      reasoning: "effort",
      vision: true,
      maxTokens: 128_000,
    },
  },
  "openai/gpt-5-chat": {
    display: { name: "GPT 5 Chat" },
    id: "openai/gpt-5-chat-latest",
    altModelIds: ["openai/gpt-5-chat-latest"],
    provider: "openai",
    capabilities: {
      reasoning: "effort",
      vision: true,
      maxTokens: 128_000,
    },
  },

  "openai/o3": {
    display: { name: "o3" },
    id: "openai/o3",
    provider: "openai",
    capabilities: {
      reasoning: "effort",
      vision: true,
      maxTokens: 100_000,
    },
  },

  "openai/o3-mini": {
    display: { name: "o3 Mini" },
    id: "openai/o3-mini",
    provider: "openai",
    capabilities: {
      reasoning: "effort",
      vision: true,
      maxTokens: 100_000,
    },
  },
  "openai/o4-mini": {
    display: { name: "o4 Mini" },
    id: "openai/o4-mini",
    provider: "openai",
    capabilities: {
      reasoning: "effort",
      vision: true,
      maxTokens: 100_000,
    },
  },
} satisfies Record<ModelIdKey, ModelData>;

export const AllModelIds = Object.keys(ModelsData) as AllModelIds[];
