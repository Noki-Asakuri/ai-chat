import type { ModelData, ModelIdKey } from "..";

export const zai = {
  "zai/glm-5.3": {
    addedAt: "2026-09-11",
    display: { name: "ZAI GLM 5.3" },
    id: "zai/glm-5.3",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "max", levels: ["low", "high", "max"] },
      toolCalling: true,
    },
  },
  "zai/glm-5.3-flash": {
    addedAt: "2026-09-11",
    display: { name: "ZAI GLM 5.3 Flash" },
    id: "zai/glm-5.3-flash",
    provider: "zai",
    modalities: { input: ["image", "text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "max", levels: ["low", "high", "max"] },
      toolCalling: true,
    },
  },
  "zai/glm-5.2": {
    display: { name: "ZAI GLM 5.2" },
    id: "zai/glm-5.2",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: {
        type: "selectable",
        defaultLevel: "max",
        levels: ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
      },
      toolCalling: true,
    },
  },
  "zai/glm-5.1": {
    display: { name: "ZAI GLM 5.1" },
    id: "zai/glm-5.1",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },
  "zai/glm-5": {
    display: { name: "ZAI GLM 5" },
    id: "zai/glm-5",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },
  "zai/glm-4.7": {
    display: { name: "ZAI GLM 4.7" },
    id: "zai/glm-4.7",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },
  "zai/glm-4.6": {
    display: { name: "ZAI GLM 4.6" },
    id: "zai/glm-4.6",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },
  "zai/glm-4.5": {
    display: { name: "ZAI GLM 4.5" },
    id: "zai/glm-4.5",
    provider: "zai",
    modalities: { input: ["text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },
} satisfies Record<ModelIdKey, ModelData>;
