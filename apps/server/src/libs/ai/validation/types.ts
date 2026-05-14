import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import type { UIChatMessage } from "@ai-chat/shared/chat/metadata";
import type { ModelIdKey } from "@ai-chat/shared/chat/models";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { MoonshotAIProviderOptions } from "@ai-sdk/moonshotai";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import type { ToolSet } from "ai";

import type { ChatModelParams } from "../types";

export type ChatProviderOptions = {
  openai: OpenAIResponsesProviderOptions;
  google: GoogleGenerativeAIProviderOptions;
  kimi: MoonshotAIProviderOptions;
  zai: MoonshotAIProviderOptions;
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
};
