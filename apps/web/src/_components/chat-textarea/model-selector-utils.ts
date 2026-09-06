import type { Provider } from "@/lib/chat/models";

export const PROVIDER_ORDER: Array<Provider> = ["google", "openai", "deepseek", "kimi", "zai"];

export function createEmptyProviderModels<T>() {
  return {
    google: Array<T>(),
    openai: Array<T>(),
    deepseek: Array<T>(),
    kimi: Array<T>(),
    zai: Array<T>(),
  };
}

export function compareModelLabelsNewestFirst(a: { label: string }, b: { label: string }): number {
  const aVersion = Number.parseFloat(a.label.match(/\d+(?:\.\d+)?/)?.[0] ?? "0");
  const bVersion = Number.parseFloat(b.label.match(/\d+(?:\.\d+)?/)?.[0] ?? "0");
  const versionDifference = bVersion - aVersion;

  if (versionDifference !== 0) return versionDifference;

  return b.label.localeCompare(a.label, undefined, { numeric: true, sensitivity: "base" });
}
