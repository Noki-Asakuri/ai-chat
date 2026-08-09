import type { ModelData, ModelIdKey } from "..";

export const kimi: Record<ModelIdKey, ModelData> = {
  "kimi/kimi-k2.5": {
    display: { name: "Kimi K2.5" },
    id: "kimi/kimi-k2.5",
    provider: "kimi",
    modalities: { input: ["image", "text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },

  "kimi/kimi-k2-thinking": {
    display: { name: "Kimi K2 Thinking" },
    id: "kimi/kimi-k2-thinking",
    provider: "kimi",

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { reasoning: { type: "fixed", level: "high" }, toolCalling: true },
  },
  "kimi/kimi-k2-0905": {
    display: { name: "Kimi K2 0905" },
    id: "kimi/kimi-k2-0905",
    provider: "kimi",
    runtime: { modelId: "kimi-k2-0905-preview" },

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { toolCalling: true },
  },
  "kimi/kimi-k2-0711": {
    display: { name: "Kimi K2 0711" },
    id: "kimi/kimi-k2-0711",
    provider: "kimi",
    runtime: { modelId: "kimi-k2-0711-preview" },

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { toolCalling: true },
  },

  "kimi/kimi-k2-thinking-turbo": {
    display: { name: "Kimi K2 Thinking Turbo" },
    id: "kimi/kimi-k2-thinking-turbo",
    provider: "kimi",

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { reasoning: { type: "fixed", level: "high" }, toolCalling: true },
  },
  "kimi/kimi-k2-turbo": {
    display: { name: "Kimi K2 Turbo" },
    id: "kimi/kimi-k2-turbo",
    provider: "kimi",
    runtime: { modelId: "kimi-k2-turbo-preview" },

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { toolCalling: true },
  },
};
