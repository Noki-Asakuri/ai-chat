import type { ModelData, ModelIdKey } from "..";

export const google: Record<ModelIdKey, ModelData> = {
  "google/gemini-2.5-flash-lite": {
    display: { name: "Gemini 2.5 Flash Lite" },
    id: "google/gemini-2.5-flash-lite",
    altModelIds: ["google/gemini-2.5-flash-lite-preview-06-17"],
    provider: "google",
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
    },
  },
  "google/gemini-2.5-flash-lite-thinking": {
    display: { name: "Gemini 2.5 Flash Lite", unique: "Gemini 2.5 Flash Lite (Thinking)" },
    id: "google/gemini-2.5-flash-lite",
    altModelIds: ["google/gemini-2.5-flash-lite-preview-06-17"],
    provider: "google",
    runtime: { modelId: "gemini-2.5-flash-lite" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["low", "medium", "high"] },
    },
  },
  "google/gemini-2.5-flash": {
    display: { name: "Gemini 2.5 Flash" },
    id: "google/gemini-2.5-flash",
    altModelIds: ["google/gemini-2.5-flash-preview-05-20"],
    provider: "google",
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
    },
  },
  "google/gemini-2.5-flash-thinking": {
    display: { name: "Gemini 2.5 Flash", unique: "Gemini 2.5 Flash (Thinking)" },
    id: "google/gemini-2.5-flash",
    altModelIds: ["google/gemini-2.5-flash-preview-05-20"],
    provider: "google",
    runtime: { modelId: "gemini-2.5-flash" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["low", "medium", "high"] },
    },
  },
  "google/gemini-2.5-flash-image": {
    display: { name: "Gemini 2.5 Flash (Image)", unique: "Gemini 2.5 Flash (Image)" },
    id: "google/gemini-2.5-flash-image",
    altModelIds: ["google/gemini-2.5-flash-image-preview"],
    provider: "google",
    modalities: { input: ["image", "pdf", "text"], output: ["image", "text"] },
    capabilities: {
    },
  },
  "google/gemini-2.5-pro-thinking": {
    display: { name: "Gemini 2.5 Pro" },
    id: "google/gemini-2.5-pro",
    altModelIds: [
      "google/gemini-2.5-pro-preview-05-06",
      "google/gemini-2.5-pro-preview-06-05",
      "google/gemini-2.5-pro",
    ],
    provider: "google",
    runtime: { modelId: "gemini-2.5-pro" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["low", "medium", "high"] },
    },
  },
  "google/gemini-3-flash": {
    display: { name: "Gemini 3 Flash" },
    id: "google/gemini-3-flash",
    altModelIds: ["google/gemini-3-flash-preview"],
    provider: "google",
    runtime: { modelId: "gemini-3-flash-preview" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
    },
  },
  "google/gemini-3-flash-thinking": {
    display: { name: "Gemini 3 Flash", unique: "Gemini 3 Flash (Thinking)" },
    id: "google/gemini-3-flash",
    altModelIds: ["google/gemini-3-flash-preview"],
    provider: "google",
    runtime: { modelId: "gemini-3-flash-preview" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["low", "medium", "high"] },
    },
  },
  "google/gemini-3-pro": {
    display: { name: "Gemini 3 Pro" },
    id: "google/gemini-3-pro",
    altModelIds: ["google/gemini-3-pro-preview"],
    provider: "google",
    runtime: { modelId: "gemini-3-pro-preview" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "low", levels: ["low", "high"] },
    },
  },
  "google/gemini-3.1-pro": {
    display: { name: "Gemini 3.1 Pro" },
    id: "google/gemini-3.1-pro",
    altModelIds: ["google/gemini-3.1-pro-preview"],
    provider: "google",
    runtime: { modelId: "gemini-3.1-pro-preview" },
    modalities: { input: ["image", "pdf", "text"], output: ["text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "medium", levels: ["low", "medium", "high"] },
    },
  },
  "google/gemini-3.1-flash-image": {
    display: { name: "Gemini 3.1 Flash (Image)", unique: "Gemini 3.1 Flash (Image)" },
    id: "google/gemini-3.1-flash-image",
    altModelIds: ["google/gemini-3.1-flash-image-preview"],
    provider: "google",
    runtime: { modelId: "gemini-3.1-flash-image-preview" },
    modalities: { input: ["image", "pdf", "text"], output: ["image", "text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "selectable", defaultLevel: "minimal", levels: ["minimal", "high"] },
    },
  },
  "google/gemini-3-pro-image": {
    display: { name: "Gemini 3 Pro (Image)", unique: "Gemini 3 Pro (Image)" },
    id: "google/gemini-3-pro-image",
    altModelIds: ["google/gemini-3-pro-image-preview"],
    provider: "google",
    runtime: { modelId: "gemini-3-pro-image-preview" },
    modalities: { input: ["image", "pdf", "text"], output: ["image", "text"] },
    capabilities: {
      toolCalling: true,
      reasoning: { type: "fixed", level: "high" },
    },
  },
};
