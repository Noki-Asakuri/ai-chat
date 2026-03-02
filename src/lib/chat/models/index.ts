// This is a hack to get around to deploy due to convex doesn't have path aliasing.
import type { Doc } from "../../../../convex/_generated/dataModel";

import { deepseek } from "./services/deepseek";
import { google } from "./services/google";
import { openai } from "./services/openai";

type ReasoningEffort = NonNullable<Doc<"messages">["metadata"]>["modelParams"]["effort"];

type Capability = {
  webSearch?: boolean;
  generateImage?: boolean;
  vision?: boolean;
  reasoning?: boolean | "always";
  customReasoningLevel?: ReasoningEffort[];
};

export type Provider = "google" | "openai" | "deepseek";
export type ModelIdKey = `${Provider}/${string}`;

export type ModelData = {
  display: { unique?: string; name: string };
  id: ModelIdKey;
  altModelIds?: string[];
  provider: Provider;
  capabilities: Capability;
};

export type ResolvedModel = {
  inputId: string;
  requestedId: ModelIdKey;
  data: ModelData;
};

export const ModelsData: Record<ModelIdKey, ModelData> = {
  ...google,
  ...openai,
  ...deepseek,
};

function isProvider(provider: string): provider is Provider {
  return provider === "google" || provider === "openai" || provider === "deepseek";
}

function isModelIdKey(modelId: string): modelId is ModelIdKey {
  const slashIndex = modelId.indexOf("/");
  if (slashIndex <= 0) return false;

  return isProvider(modelId.slice(0, slashIndex));
}

function buildModelIndexes() {
  const modelIds: Array<ModelIdKey> = [];
  const byRequestedId = new Map<ModelIdKey, ModelData>();
  const aliasToRequestedId = new Map<string, ModelIdKey>();

  for (const [requestedIdRaw, data] of Object.entries(ModelsData)) {
    if (!isModelIdKey(requestedIdRaw)) {
      throw new Error(`Invalid requested model id: ${requestedIdRaw}`);
    }

    const provider = requestedIdRaw.split("/")[0];

    if (data.provider !== provider) {
      throw new Error(
        `Provider mismatch for model ${requestedIdRaw}: expected ${provider}, got ${data.provider}`,
      );
    }

    if (!isModelIdKey(data.id)) {
      throw new Error(`Invalid canonical model id for ${requestedIdRaw}: ${data.id}`);
    }

    const requestedId = requestedIdRaw;

    modelIds.push(requestedId);
    byRequestedId.set(requestedId, data);

    const aliases = data.altModelIds ?? [];
    for (const alias of aliases) {
      const existing = aliasToRequestedId.get(alias);
      if (existing && existing !== requestedId) {
        const existingData = byRequestedId.get(existing);
        if (!existingData || existingData.id !== data.id) {
          throw new Error(
            `Duplicate alias detected: ${alias} (used by ${existing} and ${requestedId})`,
          );
        }

        continue;
      }

      aliasToRequestedId.set(alias, requestedId);
    }
  }

  return { modelIds, byRequestedId, aliasToRequestedId };
}

const { modelIds, byRequestedId, aliasToRequestedId } = buildModelIndexes();

export const AllModelIds = modelIds;
export type AllModelIds = ModelIdKey;

export function tryResolveModel(modelId: string | null | undefined): ResolvedModel | null {
  if (!modelId || modelId.length === 0) return null;

  if (isModelIdKey(modelId)) {
    const byId = byRequestedId.get(modelId);
    if (byId) {
      return { inputId: modelId, requestedId: modelId, data: byId };
    }
  }

  const requestedId = aliasToRequestedId.get(modelId);
  if (!requestedId) return null;

  const data = byRequestedId.get(requestedId);
  if (!data) return null;

  return { inputId: modelId, requestedId, data };
}

export function resolveModel(modelId: string): ResolvedModel {
  const resolved = tryResolveModel(modelId);
  if (resolved) return resolved;

  throw new Error(`Unknown model: ${modelId}`);
}

export function getModelData(modelId: string): ModelData {
  return resolveModel(modelId).data;
}

export function tryGetModelData(modelId: string | null | undefined): ModelData | null {
  const resolved = tryResolveModel(modelId);
  return resolved ? resolved.data : null;
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
