import type { ModelData, ModelIdKey } from "..";

export const deepseek: Record<ModelIdKey, ModelData> = {
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
};
