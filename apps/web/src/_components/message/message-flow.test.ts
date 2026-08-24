import { describe, expect, test } from "bun:test";

import { buildAssistantFlowBlocks, splitAssistantFlow } from "./message-flow";

describe("assistant message flow", function () {
  test("groups every tool call in the same step", function () {
    const blocks = buildAssistantFlowBlocks([
      { type: "step-start" },
      {
        type: "dynamic-tool",
        toolName: "read_file",
        toolCallId: "read-1",
        state: "output-available",
        input: {},
        output: "file",
      },
      { type: "reasoning", text: "Checking another file", state: "done" },
      {
        type: "dynamic-tool",
        toolName: "read_file",
        toolCallId: "read-2",
        state: "output-available",
        input: {},
        output: "file",
      },
    ]);

    const toolBlocks = blocks.filter((block) => block.kind === "tools");
    expect(toolBlocks).toHaveLength(1);
    expect(toolBlocks[0]?.parts).toHaveLength(2);
  });

  test("keeps tool calls from separate steps in separate groups", function () {
    const blocks = buildAssistantFlowBlocks([
      {
        type: "dynamic-tool",
        toolName: "read_file",
        toolCallId: "read-1",
        state: "output-available",
        input: {},
        output: "file",
      },
      { type: "step-start" },
      {
        type: "dynamic-tool",
        toolName: "run_command",
        toolCallId: "command-1",
        state: "output-available",
        input: {},
        output: "done",
      },
    ]);

    expect(blocks.filter((block) => block.kind === "tools")).toHaveLength(2);
  });

  test("folds work only after a successful final response", function () {
    const blocks = buildAssistantFlowBlocks([
      { type: "reasoning", text: "Investigating", state: "done" },
      {
        type: "dynamic-tool",
        toolName: "read_file",
        toolCallId: "read-1",
        state: "output-available",
        input: {},
        output: "file",
      },
      { type: "step-start" },
      { type: "text", text: "Here is the final response.", state: "done" },
    ]);

    const streamingFlow = splitAssistantFlow(blocks, { status: "streaming", metadata: undefined });
    expect(streamingFlow.hasFinalResponse).toBe(false);
    expect(streamingFlow.responseBlocks).toEqual(blocks);

    const completeFlow = splitAssistantFlow(blocks, { status: "complete", metadata: undefined });
    expect(completeFlow.hasFinalResponse).toBe(true);
    expect(completeFlow.workBlocks.at(-1)?.kind).not.toBe("step-divider");
    expect(completeFlow.responseBlocks).toHaveLength(1);

    const abortedFlow = splitAssistantFlow(blocks, {
      status: "complete",
      metadata: { finishReason: "aborted" },
    });
    expect(abortedFlow.hasFinalResponse).toBe(false);
  });
});
