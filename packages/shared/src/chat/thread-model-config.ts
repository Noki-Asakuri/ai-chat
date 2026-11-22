import type { ReasoningEffort } from "./metadata";
import { resolveReasoning, tryGetModelData } from "./models";

export type ThreadModelParams<Profile extends string> = {
  effort: ReasoningEffort;
  webSearch: boolean;
  profile: Profile | null;
};

export type ThreadModelConfig<Profile extends string> = {
  model: string;
  params: ThreadModelParams<Profile>;
};

/** A partial update: only the fields that changed. A `profile` of `null` clears it. */
export type ThreadModelConfigPatch<Profile extends string> = {
  model?: string;
  params?: Partial<ThreadModelParams<Profile>>;
};

/**
 * Merges a partial update into a thread's model config. The effort, whether given or kept, is
 * resolved for the resulting model, so a model change keeps the effort when the new model
 * supports it and falls back to its default otherwise.
 *
 * The Convex mutation and the client's optimistic update both use this, so the value shown
 * before the server confirms a change is the value the server stores.
 */
export function mergeThreadModelConfig<Profile extends string>(
  current: ThreadModelConfig<Profile>,
  patch: ThreadModelConfigPatch<Profile>,
): ThreadModelConfig<Profile> {
  const model = patch.model ?? current.model;
  const requestedEffort = patch.params?.effort ?? current.params.effort;
  const modelData = tryGetModelData(model);

  return {
    model,
    params: {
      effort: modelData ? resolveReasoning(modelData, requestedEffort) : requestedEffort,
      webSearch: patch.params?.webSearch ?? current.params.webSearch,
      profile: patch.params?.profile === undefined ? current.params.profile : patch.params.profile,
    },
  };
}
