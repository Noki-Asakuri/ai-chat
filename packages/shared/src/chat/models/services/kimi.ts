import type { ModelData, ModelIdKey } from "..";

export const kimi: Record<ModelIdKey, ModelData> = {
  "kimi/kimi-k2.5": {
    display: { name: "Kimi K2.5" },
    id: "kimi/kimi-k2.5",
    provider: "kimi",
    capabilities: { reasoning: true, webSearch: true, customReasoningLevel: ["none", "medium"] },
  },

  "kimi/kimi-k2-thinking": {
    display: { name: "Kimi K2 Thinking" },
    id: "kimi/kimi-k2-thinking",
    provider: "kimi",

    capabilities: { reasoning: "always", webSearch: true },
  },
  "kimi/kimi-k2-0905": {
    display: { name: "Kimi K2 0905" },
    id: "kimi/kimi-k2-0905",
    provider: "kimi",

    capabilities: { webSearch: true },
  },
  "kimi/kimi-k2-0711": {
    display: { name: "Kimi K2 0711" },
    id: "kimi/kimi-k2-0711",
    provider: "kimi",

    capabilities: { webSearch: true },
  },

  "kimi/kimi-k2-thinking-turbo": {
    display: { name: "Kimi K2 Thinking Turbo" },
    id: "kimi/kimi-k2-thinking-turbo",
    provider: "kimi",

    capabilities: { reasoning: "always", webSearch: true },
  },
  "kimi/kimi-k2-turbo": {
    display: { name: "Kimi K2 Turbo" },
    id: "kimi/kimi-k2-turbo",
    provider: "kimi",

    capabilities: { webSearch: true },
  },
};
