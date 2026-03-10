import { ToolLoopAgent, stepCountIs } from "ai";

import { registry } from "@/lib/server/model-registry";
import type { validateRequestBody } from "@/lib/server/validate-request-body";

type ValidatedRequest = Awaited<ReturnType<typeof validateRequestBody>>;

type BuildChatAgentOptions = {
  modelId: ValidatedRequest["model"]["id"];
  systemInstruction: string;
  providerOptions: ValidatedRequest["providerOptions"];
  tools: ValidatedRequest["tools"];
  experimentalDownload?: ConstructorParameters<typeof ToolLoopAgent>[0]["experimental_download"];
};

export function buildChatAgent(options: BuildChatAgentOptions): ToolLoopAgent {
  const { modelId, systemInstruction, providerOptions, tools, experimentalDownload } = options;

  return new ToolLoopAgent({
    model: registry(modelId),
    instructions: systemInstruction,
    tools,
    providerOptions,
    stopWhen: stepCountIs(20),
    maxRetries: 5,
    experimental_telemetry: { isEnabled: false },
    experimental_download: experimentalDownload,
  });
}
