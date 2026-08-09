import { isStepCount, ToolLoopAgent, type ToolSet } from "ai";

import { getLanguageModel } from "@/libs/ai/registry";
import type { ValidatedChatRequestBody } from "@/libs/ai/validation";

import { handleImagesCaching } from "@/libs/redis/file-caching";

const MAX_WEB_SEARCH_CALLS = 3;

type BuildChatAgentOptions = {
  systemInstruction: string;
  tools: ValidatedChatRequestBody["tools"];
  modelId: ValidatedChatRequestBody["model"]["id"];
  providerOptions: ValidatedChatRequestBody["providerOptions"];
  reasoning: ValidatedChatRequestBody["sdkReasoning"];
};

export function buildChatAgent(options: BuildChatAgentOptions): ToolLoopAgent<never, ToolSet> {
  const { modelId, reasoning, systemInstruction, providerOptions, tools } = options;
  let webSearchCalls = 0;

  return new ToolLoopAgent({
    model: getLanguageModel(modelId),
    instructions: systemInstruction,
    tools,
    maxRetries: 5,
    providerOptions,
    reasoning,
    toolApproval: function ({ toolCall }) {
      if (toolCall.toolName !== "web_search") return undefined;

      if (webSearchCalls >= MAX_WEB_SEARCH_CALLS) {
        return {
          type: "denied",
          reason: "The web search limit for this request has been reached.",
        };
      }

      webSearchCalls += 1;
      return undefined;
    },
    stopWhen: isStepCount(20),
    experimental_download: handleImagesCaching,
  });
}
