import type { ModelData, ModelIdKey } from "..";

export const deepseek: Record<ModelIdKey, ModelData> = {
  "deepseek/deepseek-chat": {
    display: { name: "DeepSeek V3" },
    id: "deepseek/deepseek-chat",
    provider: "deepseek",
    capabilities: {},
  },
  "deepseek/deepseek-reasoner": {
    display: { name: "DeepSeek R1" },
    id: "deepseek/deepseek-reasoner",
    provider: "deepseek",
    capabilities: { reasoning: "always" },
  },
};
