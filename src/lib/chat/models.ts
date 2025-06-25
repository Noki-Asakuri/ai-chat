export function getModelData(modelId: AllModelIds | (string & {})): ModelData {
  const data = ModelsData[modelId as AllModelIds];
  if (data) return data;

  for (const id of AllModelIds) {
    const data = ModelsData[id] as ModelData;
    if (data.altModelIds?.some((id) => id === modelId)) return data;
  }

  throw new Error(`Unknown model: ${modelId}`);
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
export type Provider = "google" | "openai" | "deepseek";
export type ModelData = {
  displayName: string;
  id: ModelIdKey;
  altModelIds?: string[];
  provider: Provider;
  capabilities: Capability;
};

export type AllModelIds = keyof typeof ModelsData;
export type ModelIdKey = `${Provider}/${string}`;

export const ModelsData = {
  "google/gemini-2.5-flash-lite": {
    displayName: "Gemini 2.5 Flash Lite",
    id: "google/gemini-2.5-flash-lite-preview-06-17",
    altModelIds: ["google/gemini-2.5-flash-lite-preview-06-17"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: false,
      maxTokens: 64_000,
      config: { temperature: true, topP: true, topK: true },
    },
  },
  "google/gemini-2.5-flash-lite-thinking": {
    displayName: "Gemini 2.5 Flash Lite (Thinking)",
    id: "google/gemini-2.5-flash-lite-preview-06-17",
    altModelIds: ["google/gemini-2.5-flash-lite-preview-06-17"],
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
    id: "google/gemini-2.5-flash",
    altModelIds: ["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-flash"],
    provider: "google",
    capabilities: {
      vision: true,
      webSearch: true,
      reasoning: false,
      maxTokens: 65_536,
      config: { temperature: true, topP: true, topK: true },
    },
  },
  "google/gemini-2.5-flash-thinking": {
    displayName: "Gemini 2.5 Flash (Thinking)",
    id: "google/gemini-2.5-flash",
    altModelIds: ["google/gemini-2.5-flash-preview-05-20", "google/gemini-2.5-flash"],
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
  "google/gemini-2.5-pro-thinking": {
    displayName: "Gemini 2.5 Pro",
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
      config: { temperature: true, topP: true, topK: true },
    },
  },

  "deepseek/deepseek-chat": {
    displayName: "DeepSeek V3",
    id: "deepseek/deepseek-chat",
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
    id: "deepseek/deepseek-reasoner",
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
    id: "openai/gpt-4.1",
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
    id: "openai/gpt-4.1-mini",
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
    id: "openai/chatgpt-4o",
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
    id: "openai/gpt-4o",
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
    id: "openai/gpt-4o-mini",
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
    id: "openai/o3",
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
    id: "openai/o3-mini",
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
    id: "openai/o4-mini",
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
    id: "openai/gpt-4.5-preview",
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
