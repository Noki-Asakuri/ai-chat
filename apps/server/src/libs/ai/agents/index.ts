import { isStepCount, ToolLoopAgent, type ToolSet } from "ai";

import { registry } from "@/libs/ai/registry";
import type { ValidatedChatRequestBody } from "@/libs/ai/validation";

import { handleImagesCaching } from "@/libs/redis/file-caching";

type BuildChatAgentOptions = {
  systemInstruction: string;
  tools: ValidatedChatRequestBody["tools"];
  modelId: ValidatedChatRequestBody["model"]["id"];
  providerOptions: ValidatedChatRequestBody["providerOptions"];
};

export function buildChatAgent(options: BuildChatAgentOptions): ToolLoopAgent<never, ToolSet> {
  const { modelId, systemInstruction, providerOptions, tools } = options;

  return new ToolLoopAgent({
    model: registry(modelId),
    instructions: systemInstruction,
    tools,
    maxRetries: 5,
    providerOptions,
    stopWhen: isStepCount(20),
    experimental_download: handleImagesCaching,
  });
}
