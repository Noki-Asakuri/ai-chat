// Shared defaults must stay free of backend initialization so the browser can import them.
export const DEFAULT_GENERAL_SETTINGS = {
  models: {
    defaultModel: "google/gemini-3-flash",
    modelParams: { effort: "none" as const, webSearch: false },
  },
  confirmations: { unpin: false, settle: false, delete: true },
  textGeneration: { model: "openai/gpt-5.6-luna", effort: "medium" as const },
  threads: { autoSettleDays: 0 },
};
