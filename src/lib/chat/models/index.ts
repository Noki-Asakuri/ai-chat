import { deepseek } from "./services/deepseek";
import { google } from "./services/google";
import { openai } from "./services/openai";

// This is a hack to get around to deploy due to convex doesn't have path aliasing.
import type { Doc } from "../../../../convex/_generated/dataModel";

export function getModelData(modelId: AllModelIds | (string & {})): ModelData {
  const data = ModelsData[modelId as AllModelIds];
  if (data) return data;

  for (const id of AllModelIds) {
    const data = ModelsData[id]!;
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

type ReasoningEffort = NonNullable<Doc<"messages">["metadata"]>["modelParams"]["effort"];

type Capability = {
  webSearch?: boolean;
  generateImage?: boolean;
  vision?: boolean;
  reasoning?: boolean | "always";
  customReasoningLevel?: ReasoningEffort[];
};
export type Provider = "google" | "openai" | "deepseek";
export type ModelData = {
  display: { unique?: string; name: string };
  id: ModelIdKey;
  altModelIds?: string[];
  provider: Provider;
  capabilities: Capability;
};

export const ModelsData: Record<ModelIdKey, ModelData> = {
  ...google,
  ...openai,
  ...deepseek,
};

export type AllModelIds = keyof typeof ModelsData;
export type ModelIdKey = `${Provider}/${string}`;
export const AllModelIds = Object.keys(ModelsData) as AllModelIds[];
