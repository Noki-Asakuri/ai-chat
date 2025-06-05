export function getModelData(modelId: AllModelIds | (string & {})): ModelData {
  const data = ModelsData[modelId as AllModelIds];

  if (!data)
    return {
      displayName: modelId,
      provider: "unknown",
      capabilities: { webSearch: false, reasoning: false, vision: false },
    };
  return data;
}

type Capability = Record<"webSearch" | "reasoning" | "vision", boolean>;
export type Provider = "google" | "openai" | "deepseek" | "unknown";
export type ModelData = {
  displayName: string;
  provider: Provider;
  capabilities: Capability;
};

export type AllModelIds = keyof typeof ModelsData;
export type ModelIdKey = `${Provider}/${string}`;

export const ModelsData = {
  "google/gemini-2.5-flash-preview-05-20": {
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    capabilities: { webSearch: true, reasoning: true, vision: true },
  },
  "google/gemini-2.5-pro-preview-06-05": {
    displayName: "Gemini 2.5 Pro",
    provider: "google",
    capabilities: { webSearch: true, reasoning: true, vision: true },
  },
  "google/gemini-2.0-flash": {
    displayName: "Gemini 2.0 Flash",
    provider: "google",
    capabilities: { webSearch: true, reasoning: false, vision: true },
  },
  "google/gemini-2.0-flash-lite": {
    displayName: "Gemini 2.0 Flash Lite",
    provider: "google",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },

  "deepseek/deepseek-chat": {
    displayName: "DeepSeek V3",
    provider: "deepseek",
    capabilities: { webSearch: false, reasoning: false, vision: false },
  },
  "deepseek/deepseek-reasoner": {
    displayName: "DeepSeek R1",
    provider: "deepseek",
    capabilities: { webSearch: false, reasoning: true, vision: false },
  },

  "openai/gpt-4.1": {
    displayName: "GPT-4.1",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },
  "openai/gpt-4.1-mini": {
    displayName: "GPT-4.1 Mini",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },
  "openai/gpt-4.1-nano": {
    displayName: "GPT-4.1 Nano",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },

  "openai/chatgpt-4o": {
    displayName: "ChatGPT 4o",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },
  "openai/gpt-4o": {
    displayName: "GPT-4o",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },
  "openai/gpt-4o-mini": {
    displayName: "GPT-4o Mini",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },

  "openai/o1": {
    displayName: "o1",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: true, vision: true },
  },
  "openai/o3": {
    displayName: "o3",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: true, vision: true },
  },

  "openai/o3-mini": {
    displayName: "o3 Mini",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: true, vision: true },
  },
  "openai/o4-mini": {
    displayName: "o4 Mini",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: true, vision: true },
  },

  "openai/gpt-4.5-preview": {
    displayName: "GPT-4.5 Preview",
    provider: "openai",
    capabilities: { webSearch: false, reasoning: false, vision: true },
  },
} satisfies Record<ModelIdKey, ModelData>;

export const AllModelIds = Object.keys(ModelsData) as AllModelIds[];
export const ModelsByProvider = Object.entries(ModelsData).reduce(
  (acc, [key, value]) => {
    acc[value.provider] ??= [];
    acc[value.provider].push(key as AllModelIds);
    return acc;
  },
  {} as Record<Provider, AllModelIds[]>,
);
