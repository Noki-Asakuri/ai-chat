import { useSessionId as useConvexSessionId } from "convex-helpers/react/sessions";

export function useSessionId() {
  const [sessionId] = useConvexSessionId() as readonly [string, () => void, Promise<string>];
  return sessionId;
}
