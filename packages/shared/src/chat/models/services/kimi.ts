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
    deprecation: {
      message: "Kimi K2.5 is being sunset by Moonshot AI. Please switch to Kimi K3.",
      replacementModelId: "kimi/kimi-k3",
    },
  },
  "kimi/kimi-k2.6": {
    display: { name: "Kimi K2.6" },
    id: "kimi/kimi-k2.6",
    provider: "kimi",
    modalities: { input: ["image", "text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["none", "medium"] },
      toolCalling: true,
    },
  },
  "kimi/kimi-k2.7-code": {
    display: { name: "Kimi K2.7 Code" },
    id: "kimi/kimi-k2.7-code",
    provider: "kimi",
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "fixed", level: "high" },
      toolCalling: true,
    },
  },
  "kimi/kimi-k3": {
    display: { name: "Kimi K3" },
    id: "kimi/kimi-k3",
    provider: "kimi",
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      reasoning: { type: "fixed", level: "max" },
      toolCalling: true,
    },
  },

  "kimi/kimi-k2-thinking": {
    display: { name: "Kimi K2 Thinking" },
    id: "kimi/kimi-k2-thinking",
    provider: "kimi",

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { reasoning: { type: "fixed", level: "high" }, toolCalling: true },
    deprecation: {
      message: "Kimi K2 Thinking is deprecated by Moonshot AI. Please switch to Kimi K3.",
      replacementModelId: "kimi/kimi-k3",
    },
  },
  "kimi/kimi-k2-0905": {
    display: { name: "Kimi K2 0905" },
    id: "kimi/kimi-k2-0905",
    provider: "kimi",
    runtime: { modelId: "kimi-k2-0905-preview" },

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { toolCalling: true },
    deprecation: {
      message: "Kimi K2 0905 is deprecated by Moonshot AI. Please switch to Kimi K3.",
      replacementModelId: "kimi/kimi-k3",
    },
  },
  "kimi/kimi-k2-0711": {
    display: { name: "Kimi K2 0711" },
    id: "kimi/kimi-k2-0711",
    provider: "kimi",
    runtime: { modelId: "kimi-k2-0711-preview" },

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { toolCalling: true },
    deprecation: {
      message: "Kimi K2 0711 is deprecated by Moonshot AI. Please switch to Kimi K3.",
      replacementModelId: "kimi/kimi-k3",
    },
  },

  "kimi/kimi-k2-thinking-turbo": {
    display: { name: "Kimi K2 Thinking Turbo" },
    id: "kimi/kimi-k2-thinking-turbo",
    provider: "kimi",

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { reasoning: { type: "fixed", level: "high" }, toolCalling: true },
    deprecation: {
      message: "Kimi K2 Thinking Turbo is deprecated by Moonshot AI. Please switch to Kimi K3.",
      replacementModelId: "kimi/kimi-k3",
    },
  },
  "kimi/kimi-k2-turbo": {
    display: { name: "Kimi K2 Turbo" },
    id: "kimi/kimi-k2-turbo",
    provider: "kimi",
    runtime: { modelId: "kimi-k2-turbo-preview" },

    modalities: { input: ["text"], output: ["text"] },
    capabilities: { toolCalling: true },
    deprecation: {
      message: "Kimi K2 Turbo is deprecated by Moonshot AI. Please switch to Kimi K3.",
      replacementModelId: "kimi/kimi-k3",
    },
  },
};
