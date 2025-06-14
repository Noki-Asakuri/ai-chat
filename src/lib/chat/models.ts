export function getModelData(modelId: AllModelIds | (string & {})): ModelData {
  const data = ModelsData[modelId as AllModelIds];
  if (data) return data;

  for (const id of AllModelIds) {
    const data = ModelsData[id] as ModelData;
    if (data.modelIds?.includes(modelId)) return data;
  }

  return {
    displayName: modelId,
    provider: "unknown",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: false,
      maxTokens: 4096,
    },
  };
}

type Capability = {
  webSearch: boolean;
  reasoning: "budget" | "effort" | "always" | false;
  budgetLimit?: { min: number; max: number };

  vision: boolean;
  maxTokens: number;
};
export type Provider = "google" | "openai" | "deepseek" | "unknown";
export type ModelData = {
  displayName: string;
  modelIds?: string[];
  provider: Provider;
  capabilities: Capability;
};

export type AllModelIds = keyof typeof ModelsData;
export type ModelIdKey = `${Provider}/${string}`;

export const ModelsData = {
  "google/gemini-2.5-flash-preview-05-20": {
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    capabilities: {
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 0, max: 24_576 },
      vision: true,
      maxTokens: 65_536,
    },
  },
  "google/gemini-2.5-pro-preview-06-05": {
    displayName: "Gemini 2.5 Pro",
    modelIds: ["google/gemini-2.5-pro-preview-05-06"],
    provider: "google",
    capabilities: {
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 128, max: 32_768 },
      vision: true,
      maxTokens: 65_536,
    },
  },
  "google/gemini-2.0-flash": {
    displayName: "Gemini 2.0 Flash",
    provider: "google",
    capabilities: {
      webSearch: true,
      reasoning: false,
      vision: true,
      maxTokens: 8_192,
    },
  },
  "google/gemini-2.0-flash-lite": {
    displayName: "Gemini 2.0 Flash Lite",
    provider: "google",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 8_192,
    },
  },

  "deepseek/deepseek-chat": {
    displayName: "DeepSeek V3",
    provider: "deepseek",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: false,
      maxTokens: 8_192,
    },
  },
  "deepseek/deepseek-reasoner": {
    displayName: "DeepSeek R1",
    provider: "deepseek",
    capabilities: {
      webSearch: false,
      reasoning: "always",
      vision: false,
      maxTokens: 65_536,
    },
  },

  "openai/gpt-4.1": {
    displayName: "GPT-4.1",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 32_768,
    },
  },
  "openai/gpt-4.1-mini": {
    displayName: "GPT-4.1 Mini",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 32_768,
    },
  },
  "openai/chatgpt-4o": {
    displayName: "ChatGPT 4o",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 16_384,
    },
  },
  "openai/gpt-4o": {
    displayName: "GPT-4o",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 16_384,
    },
  },
  "openai/gpt-4o-mini": {
    displayName: "GPT-4o Mini",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 16_384,
    },
  },
  "openai/o3": {
    displayName: "o3",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: "effort",
      vision: true,
      maxTokens: 100_000,
    },
  },

  "openai/o3-mini": {
    displayName: "o3 Mini",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: "effort",
      vision: true,
      maxTokens: 100_000,
    },
  },
  "openai/o4-mini": {
    displayName: "o4 Mini",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: "effort",
      vision: true,
      maxTokens: 100_000,
    },
  },

  "openai/gpt-4.5-preview": {
    displayName: "GPT-4.5 Preview",
    provider: "openai",
    capabilities: {
      webSearch: false,
      reasoning: false,
      vision: true,
      maxTokens: 16_384,
    },
  },
} satisfies Record<ModelIdKey, ModelData>;

export const AllModelIds = Object.keys(ModelsData) as AllModelIds[];
