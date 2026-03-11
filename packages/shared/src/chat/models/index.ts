import type { ReasoningEffort } from "../metadata";

import { deepseek } from "./services/deepseek";
import { google } from "./services/google";
import { openai } from "./services/openai";

type Capability = {
  webSearch?: boolean;
  generateImage?: boolean;
  vision?: boolean;
  reasoning?: boolean | "always";
  customReasoningLevel?: ReasoningEffort[];
};

export type Provider = "google" | "openai" | "deepseek";
export type ModelIdKey = `${Provider}/${string}`;

export type ModelDeprecation = {
  message: string;
  replacementModelId: ModelIdKey;
};

export type ModelData = {
  display: { unique?: string; name: string };
  id: ModelIdKey;
  altModelIds?: string[];
  provider: Provider;
  capabilities: Capability;
  deprecation?: ModelDeprecation;
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
  const selectableModelIds: Array<ModelIdKey> = [];
  const deprecatedModelIds: Array<ModelIdKey> = [];

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

    if (data.deprecation) {
      deprecatedModelIds.push(requestedId);
    } else {
      selectableModelIds.push(requestedId);
    }

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

  for (const [requestedId, data] of byRequestedId.entries()) {
    const deprecation = data.deprecation;
    if (!deprecation) continue;

    if (deprecation.replacementModelId === requestedId) {
      throw new Error(`Model deprecation replacement cannot reference itself: ${requestedId}`);
    }

    const replacementModel = byRequestedId.get(deprecation.replacementModelId);
    if (!replacementModel) {
      throw new Error(
        `Missing deprecation replacement model for ${requestedId}: ${deprecation.replacementModelId}`,
      );
    }
  }

  return {
    modelIds,
    selectableModelIds,
    deprecatedModelIds,
    byRequestedId,
    aliasToRequestedId,
  };
}

const { modelIds, selectableModelIds, deprecatedModelIds, byRequestedId, aliasToRequestedId } =
  buildModelIndexes();

export const AllModelIds = modelIds;
export type AllModelIds = ModelIdKey;

export const SelectableModelIds = selectableModelIds;
export const DeprecatedModelIds = deprecatedModelIds;

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

export function tryGetModelDeprecation(
  modelId: string | null | undefined,
): ModelDeprecation | null {
  return tryGetModelData(modelId)?.deprecation ?? null;
}

export function isDeprecatedModel(modelId: string | null | undefined): boolean {
  return tryGetModelDeprecation(modelId) !== null;
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
