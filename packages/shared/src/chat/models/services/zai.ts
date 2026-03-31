import type { ModelData, ModelIdKey } from "..";

export const zai: Record<ModelIdKey, ModelData> = {
  "zai/glm-5": {
    display: { name: "ZAI GLM 5" },
    id: "zai/glm-5",
    provider: "zai",
    capabilities: { reasoning: true, customReasoningLevel: ["none", "medium"] },
  },
  "zai/glm-4.7": {
    display: { name: "ZAI GLM 4.7" },
    id: "zai/glm-4.7",
    provider: "zai",
    capabilities: { reasoning: true, customReasoningLevel: ["none", "medium"] },
  },
  "zai/glm-4.6": {
    display: { name: "ZAI GLM 4.6" },
    id: "zai/glm-4.6",
    provider: "zai",
    capabilities: { reasoning: true, customReasoningLevel: ["none", "medium"] },
  },
  "zai/glm-4.5": {
    display: { name: "ZAI GLM 4.5" },
    id: "zai/glm-4.5",
    provider: "zai",
    capabilities: { reasoning: true, customReasoningLevel: ["none", "medium"] },
  },
};
