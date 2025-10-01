import type { ModelData, ModelIdKey } from "..";

export const deepseek: Record<ModelIdKey, ModelData> = {
  "deepseek/deepseek-chat": {
    display: { name: "DeepSeek Chat" },
    id: "deepseek/deepseek-chat",
    provider: "deepseek",
    capabilities: {},
  },
  "deepseek/deepseek-reasoner": {
    display: { name: "DeepSeek Reasoner" },
    id: "deepseek/deepseek-reasoner",
    provider: "deepseek",
    capabilities: { reasoning: "always" },
  },
};
