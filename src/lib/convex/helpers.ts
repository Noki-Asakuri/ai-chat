import { convexQuery } from "@convex-dev/react-query";
import { useSessionId, type SessionQueryArgsArray } from "convex-helpers/react/sessions";
import { type FunctionReference, type OptionalRestArgs } from "convex/server";

export function convexSessionQuery<Query extends FunctionReference<"query">>(
  funcRef: Query,
  ...argsOrSkip: SessionQueryArgsArray<Query>
) {
  const [sessionId] = useSessionId();
  const skip = argsOrSkip[0] === "skip" || !sessionId;
  const originalArgs = argsOrSkip[0] === "skip" ? {} : (argsOrSkip[0] ?? {});

  const newArgs = skip ? "skip" : { ...originalArgs, sessionId };

  // @ts-expect-error
  return convexQuery(funcRef, ...([newArgs] as OptionalRestArgs<SessionQueryArgsArray<Query>>));
}
