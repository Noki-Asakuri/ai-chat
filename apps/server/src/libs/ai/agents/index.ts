import { Experimental_Agent, stepCountIs } from "ai";

import { registry } from "@/libs/ai/registry";
import type { ValidatedChatRequestBody } from "@/libs/ai/validation";

type BuildChatAgentOptions = {
  systemInstruction: string;
  tools: ValidatedChatRequestBody["tools"];
  modelId: ValidatedChatRequestBody["model"]["id"];
  providerOptions: ValidatedChatRequestBody["providerOptions"];
};

export function buildChatAgent(options: BuildChatAgentOptions): Experimental_Agent {
  const { modelId, systemInstruction, providerOptions, tools } = options;

  return new Experimental_Agent({
    model: registry(modelId),
    instructions: systemInstruction,
    tools,
    providerOptions,
    stopWhen: stepCountIs(20),
    maxRetries: 5,
    experimental_telemetry: { isEnabled: false },
  });
}
