export function getModelData(modelId: string) {
  switch (true) {
    case modelId.startsWith("gpt-4.1-mini"):
      return {
        displayName: "GPT-4.1 Mini",
      };
    case modelId.startsWith("gpt-4.1-nano"):
      return {
        displayName: "GPT-4.1 Nano",
      };
    case modelId.startsWith("gpt-4.1"):
      return {
        displayName: "GPT-4.1",
      };
    case modelId.startsWith("gpt-4.0"):
      return {
        displayName: "GPT-4.0",
      };
    case modelId.startsWith("gpt-3.5-turbo"):
      return {
        displayName: "GPT-3.5 Turbo",
      };

    case modelId.startsWith("gemini-2.5-flash"):
      return {
        displayName: "Gemini 2.5 Flash",
      };
    case modelId.startsWith("gemini-2.5-pro"):
      return {
        displayName: "Gemini 2.5 Pro",
      };

    case modelId.startsWith("deepseek-reasoner"):
      return {
        displayName: "DeepSeek R1",
      };
    case modelId.startsWith("deepseek-chat"):
      return {
        displayName: "DeepSeek V3",
      };

    default:
      return {
        displayName: modelId,
      };
  }
}
