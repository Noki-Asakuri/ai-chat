import { ToolLoopAgent, stepCountIs } from "ai";

import { registry } from "./model-registry";

type ValidatedRequest = Awaited<
  ReturnType<typeof import("./validate-request-body").validateRequestBody>
>;

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
