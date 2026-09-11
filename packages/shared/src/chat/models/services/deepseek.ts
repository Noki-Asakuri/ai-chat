import type { ModelData, ModelIdKey } from "..";

export const deepseek = {
  "deepseek/deepseek-v4.1-flash": {
    addedAt: "2026-09-11",
    display: { name: "DeepSeek V4.1 Flash" },
    id: "deepseek/deepseek-v4.1-flash",
    altModelIds: ["deepseek/deepseek-flash"],
    provider: "deepseek",
    // This supported alias serves V4.1 and preserves the SDK's V4 reasoning history handling.
    runtime: { modelId: "deepseek-v4-flash" },
    modalities: { input: ["image", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "high", levels: ["none", "low", "high", "max"] },
    },
  },
  "deepseek/deepseek-v4-flash": {
    display: { name: "DeepSeek V4 Flash" },
    id: "deepseek/deepseek-v4-flash",
    altModelIds: ["deepseek/deepseek-chat"],
    provider: "deepseek",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
    },
  },
  "deepseek/deepseek-v4-pro": {
    display: { name: "DeepSeek V4 Pro" },
    id: "deepseek/deepseek-v4-pro",
    altModelIds: ["deepseek/deepseek-reasoner"],
    provider: "deepseek",
    runtime: { modelId: "deepseek-v4-pro" },
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "low", "medium", "high", "xhigh"] },
      toolCalling: true,
    },
  },
} satisfies Record<ModelIdKey, ModelData>;
