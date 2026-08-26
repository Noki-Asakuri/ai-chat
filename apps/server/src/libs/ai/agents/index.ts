import { isStepCount, ToolLoopAgent, type ToolSet } from "ai";

import { getLanguageModel } from "@/libs/ai/registry";
import type { ValidatedChatRequestBody } from "@/libs/ai/validation";

import { handleImagesCaching } from "@/libs/redis/file-caching";
import { getActiveToolsWithinWebSearchLimit, WEB_SEARCH_TOOL_NAME } from "./web-search-limit";

type BuildChatAgentOptions = {
  systemInstruction: string;
  tools: ValidatedChatRequestBody["tools"];
  modelId: ValidatedChatRequestBody["model"]["id"];
  providerOptions: ValidatedChatRequestBody["providerOptions"];
  reasoning: ValidatedChatRequestBody["sdkReasoning"];
};

export function buildChatAgent(options: BuildChatAgentOptions): ToolLoopAgent<never, ToolSet> {
  const { modelId, reasoning, systemInstruction, providerOptions, tools } = options;
  const hasWebSearch = Object.hasOwn(tools, WEB_SEARCH_TOOL_NAME);

  return new ToolLoopAgent({
    model: getLanguageModel(modelId),
    instructions: systemInstruction,
    tools,
    maxRetries: 5,
    providerOptions: hasWebSearch
      ? {
          ...providerOptions,
          openai: { ...providerOptions.openai, parallelToolCalls: false },
        }
      : providerOptions,
    reasoning,
    prepareStep: function ({ steps }) {
      return {
        activeTools: getActiveToolsWithinWebSearchLimit(Object.keys(tools), steps),
      };
    },
    stopWhen: isStepCount(20),
    experimental_download: handleImagesCaching,
  });
}
