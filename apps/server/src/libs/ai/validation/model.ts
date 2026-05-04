import { Result, type Result as BetterResult } from "better-result";

import {
  getModelData,
  tryResolveModel,
  type ResolvedModel,
} from "@ai-chat/shared/chat/models";

import { DeprecatedModelError, MissingModelError, UnknownModelError } from "./errors";

export function resolveRequestedModel(
  modelId: string,
): BetterResult<ResolvedModel, MissingModelError | UnknownModelError> {
  if (modelId.length === 0) {
    return Result.err(new MissingModelError({ message: "No model provided" }));
  }

  const resolvedModel = tryResolveModel(modelId);
  if (!resolvedModel) {
    return Result.err(new UnknownModelError({ modelId, message: `Unknown model: ${modelId}` }));
  }

  return Result.ok(resolvedModel);
}

export function validateModelAvailability(
  resolvedModel: ResolvedModel,
): BetterResult<ResolvedModel, DeprecatedModelError> {
  const { data: modelInfo, requestedId } = resolvedModel;
  const deprecation = modelInfo.deprecation;
  if (!deprecation) return Result.ok(resolvedModel);

  const replacementModel = getModelData(deprecation.replacementModelId);

  return Result.err(
    new DeprecatedModelError({
      code: "MODEL_DEPRECATED",
      message: deprecation.message,
      details: {
        modelId: requestedId,
        modelName: modelInfo.display.unique ?? modelInfo.display.name,
        replacementModelId: deprecation.replacementModelId,
        replacementModelName: replacementModel.display.unique ?? replacementModel.display.name,
      },
    }),
  );
}
