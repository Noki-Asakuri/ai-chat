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
      config: {
        temperature: true,
        topP: true,
        topK: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
  config: {
    temperature?: boolean;
    topP?: boolean;
    topK?: boolean;
    presencePenalty?: boolean;
    frequencyPenalty?: boolean;
  };

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
  "google/gemini-2.5-flash-lite-preview-06-17": {
    displayName: "Gemini 2.5 Flash Lite",
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 512, max: 24_576 },
      maxTokens: 64_000,
      config: { temperature: true, topP: true, topK: true },
    },
  },
  "google/gemini-2.5-flash": {
    displayName: "Gemini 2.5 Flash",
    modelIds: ["google/gemini-2.5-flash-preview-05-20"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 0, max: 24_576 },
      maxTokens: 65_536,
      config: { temperature: true, topP: true, topK: true },
    },
  },
  "google/gemini-2.5-pro": {
    displayName: "Gemini 2.5 Pro",
    modelIds: ["google/gemini-2.5-pro-preview-05-06", "google/gemini-2.5-pro-preview-06-05"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: "budget",
      budgetLimit: { min: 128, max: 32_768 },
      maxTokens: 65_536,
      config: { temperature: true, topP: true, topK: true },
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
      config: {
        temperature: true,
        topP: true,
        topK: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {},
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
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
      config: {
        temperature: true,
        topP: true,
        presencePenalty: true,
        frequencyPenalty: true,
      },
    },
  },
} satisfies Record<ModelIdKey, ModelData>;

export const AllModelIds = Object.keys(ModelsData) as AllModelIds[];
