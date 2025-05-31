export function getModelPublicName(modelId: string) {
  switch (true) {
    case modelId.startsWith("gpt-4.1"):
      return "GPT-4.1";
    case modelId.startsWith("gpt-4.0"):
      return "GPT-4.0";
    case modelId.startsWith("gpt-3.5-turbo"):
      return "GPT-3.5 Turbo";
    default:
      return modelId;
  }
}
