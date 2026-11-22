import type { ReasoningEffort } from "./metadata";
import { resolveReasoning, tryGetModelData } from "./models";

export type ThreadModelParams<ProfileId extends string = string> = {
  effort: ReasoningEffort;
  webSearch: boolean;
  profile: ProfileId | null;
};

export type ThreadModelConfig<ProfileId extends string = string> = {
  model: string;
  modelParams: ThreadModelParams<ProfileId>;
};

/** Only the settings a control changed. Anything left out keeps its current value. */
export type ThreadModelConfigPatch<ProfileId extends string = string> = {
  model?: string;
  effort?: ReasoningEffort;
  webSearch?: boolean;
  profile?: ProfileId | null;
};

/**
 * Applies a partial change to a thread's model settings. The effort is then resolved for the
 * resulting model, so a model change keeps a supported effort. The server mutation, the client's
 * optimistic update and the welcome page's local settings all use this one function, so they agree.
 */
export function applyThreadModelConfigPatch<ProfileId extends string>(
  current: ThreadModelConfig<ProfileId>,
  patch: ThreadModelConfigPatch<ProfileId>,
): ThreadModelConfig<ProfileId> {
  const model = patch.model ?? current.model;
  const requestedEffort = patch.effort ?? current.modelParams.effort;
  const modelData = tryGetModelData(model);

  return {
    model,
    modelParams: {
      effort: modelData ? resolveReasoning(modelData, requestedEffort) : requestedEffort,
      webSearch: patch.webSearch ?? current.modelParams.webSearch,
      profile: patch.profile === undefined ? current.modelParams.profile : patch.profile,
    },
  };
}

export function isSameThreadModelConfig(a: ThreadModelConfig, b: ThreadModelConfig) {
  return (
    a.model === b.model &&
    a.modelParams.effort === b.modelParams.effort &&
    a.modelParams.webSearch === b.modelParams.webSearch &&
    a.modelParams.profile === b.modelParams.profile
  );
}

export const DEFAULT_THREAD_MODEL_PARAMS: ThreadModelParams<never> = {
  effort: "medium",
  webSearch: false,
  profile: null,
};

/**
 * Reads a thread row's stored settings as the composer shows them. Older rows can lack some params;
 * those get the defaults. The stored effort is resolved for the stored model (a retry with another
 * model can save an effort that model doesn't offer), so a later change starts from the value the
 * user saw, on the server and in the client's optimistic update alike.
 */
export function readStoredThreadModelConfig<ProfileId extends string>(
  model: string,
  params: Partial<ThreadModelParams<ProfileId>> | undefined,
): ThreadModelConfig<ProfileId> {
  const stored = {
    model,
    modelParams: {
      effort: params?.effort ?? DEFAULT_THREAD_MODEL_PARAMS.effort,
      webSearch: params?.webSearch ?? DEFAULT_THREAD_MODEL_PARAMS.webSearch,
      profile: params?.profile ?? null,
    },
  };
  return applyThreadModelConfigPatch(stored, {});
}
