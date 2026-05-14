import type { ModelData, ModelIdKey } from "..";

export const deepseek: Record<ModelIdKey, ModelData> = {
  "deepseek/deepseek-v4-flash": {
    display: { name: "DeepSeek V4 Flash" },
    id: "deepseek/deepseek-v4-flash",
    altModelIds: ["deepseek/deepseek-chat"],
    provider: "deepseek",
    capabilities: {
      webSearch: true,
    },
  },
  "deepseek/deepseek-v4-pro": {
    display: { name: "DeepSeek V4 Pro" },
    id: "deepseek/deepseek-v4-pro",
    altModelIds: ["deepseek/deepseek-reasoner"],
    provider: "deepseek",
    capabilities: {
      reasoning: true,
      webSearch: true,
      customReasoningLevel: ["none", "low", "medium", "high", "xhigh"],
    },
  },
};
