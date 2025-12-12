import type { ModelData, ModelIdKey } from "..";

export const openai: Record<ModelIdKey, ModelData> = {
  "openai/gpt-4.1": {
    display: { name: "GPT 4.1" },
    id: "openai/gpt-4.1",
    provider: "openai",
    capabilities: {
      vision: true,
    },
  },
  "openai/chatgpt-4o": {
    display: { name: "ChatGPT 4o" },
    id: "openai/chatgpt-4o",
    provider: "openai",
    capabilities: {
      vision: true,
    },
  },
  "openai/gpt-4o": {
    display: { name: "GPT 4o" },
    id: "openai/gpt-4o",
    provider: "openai",
    capabilities: {
      vision: true,
    },
  },

  "openai/gpt-5": {
    display: { name: "GPT 5" },
    id: "openai/gpt-5",
    provider: "openai",
    capabilities: {
      generateImage: true,
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },
  "openai/gpt-5-mini": {
    display: { name: "GPT 5 Mini" },
    id: "openai/gpt-5-mini",
    provider: "openai",
    capabilities: {
      generateImage: true,
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },
  "openai/gpt-5-nano": {
    display: { name: "GPT 5 Nano" },
    id: "openai/gpt-5-nano",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },
  "openai/gpt-5-chat": {
    display: { name: "GPT 5 Chat" },
    id: "openai/gpt-5-chat",
    altModelIds: ["openai/gpt-5-chat-latest"],
    provider: "openai",
    capabilities: {
      webSearch: true,
      vision: true,
    },
  },
  "openai/gpt-5-codex": {
    display: { name: "GPT 5 Codex" },
    id: "openai/gpt-5-codex",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },
  "openai/gpt-5-pro": {
    display: { name: "GPT 5 Pro" },
    id: "openai/gpt-5-pro",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },

  "openai/gpt-5.1": {
    display: { name: "GPT 5.1" },
    id: "openai/gpt-5.1",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
      customReasoningLevel: ["none", "low", "medium", "high"],
    },
  },

  "openai/gpt-5.1-chat": {
    display: { name: "GPT 5.1 Chat" },
    id: "openai/gpt-5.1-chat",
    provider: "openai",
    capabilities: {
      webSearch: true,
      vision: true,
    },
  },

  "openai/gpt-5.1-codex": {
    display: { name: "GPT 5.1 Codex" },
    id: "openai/gpt-5.1-codex",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },

  "openai/gpt-5.1-codex-mini": {
    display: { name: "GPT 5.1 Codex Mini" },
    id: "openai/gpt-5.1-codex-mini",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },

  "openai/gpt-5.2": {
    display: { name: "GPT 5.2" },
    id: "openai/gpt-5.2",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },

  "openai/gpt-5.2-chat": {
    display: { name: "GPT 5.2 Chat" },
    id: "openai/gpt-5.2-chat",
    provider: "openai",
    capabilities: {
      webSearch: true,
      vision: true,
    },
  },

  "openai/gpt-5.2-pro": {
    display: { name: "GPT 5.2 Pro" },
    id: "openai/gpt-5.2-pro",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },

  "openai/o3": {
    display: { name: "o3" },
    id: "openai/o3",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },

  "openai/o3-mini": {
    display: { name: "o3 Mini" },
    id: "openai/o3-mini",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },
  "openai/o4-mini": {
    display: { name: "o4 Mini" },
    id: "openai/o4-mini",
    provider: "openai",
    capabilities: {
      webSearch: true,
      reasoning: true,
      vision: true,
    },
  },
};
