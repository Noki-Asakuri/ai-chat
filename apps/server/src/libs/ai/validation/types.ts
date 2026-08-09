import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import type { ReasoningEffort, UIChatMessage } from "@ai-chat/shared/chat/metadata";
import type { ModelIdKey } from "@ai-chat/shared/chat/models";

import type { DeepSeekLanguageModelOptions } from "@ai-sdk/deepseek";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { MoonshotAILanguageModelOptions } from "@ai-sdk/moonshotai";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { OpenAICompatibleLanguageModelChatOptions } from "@ai-sdk/openai-compatible";
import type { ModelMessage, ProviderOptions } from "@ai-sdk/provider-utils";
import type { ToolLoopAgentSettings, ToolSet } from "ai";

import type { ChatModelParams } from "../types";

export type ChatProviderOptions = ProviderOptions & {
  openai: OpenAIResponsesProviderOptions;
  deepseek: DeepSeekLanguageModelOptions;
  google: GoogleLanguageModelOptions;
  moonshotai: MoonshotAILanguageModelOptions;
  zai: OpenAICompatibleLanguageModelChatOptions & {
    thinking?: { type: "enabled" | "disabled" };
  };
};

export type ValidatedChatRequestBody = {
  messages: Array<UIChatMessage>;
  modelMessages: Array<ModelMessage>;

  assistantMessageId: Id<"messages">;
  threadId: Id<"threads">;

  modelParams: ChatModelParams;
  model: { id: ModelIdKey; uniqueId: ModelIdKey };

  tools: ToolSet;
  providerOptions: ChatProviderOptions;
  reasoning: ReasoningEffort;
  sdkReasoning: ToolLoopAgentSettings["reasoning"];
};
