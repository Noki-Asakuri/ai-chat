import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type DynamicToolUIPart,
  type FileUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
  type UIDataTypes,
  type UIMessage,
  type UIMessageChunk,
  type UITools,
} from "ai";

export function parseUIMessageChunkStream(
  stream: ReadableStream<Uint8Array>,
): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({ stream, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream({
      transform(result, controller) {
        if (result.success) controller.enqueue(result.value);
      },
    }),
  );
}

export {
  readUIMessageStream,
  type DynamicToolUIPart,
  type FileUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
  type UIDataTypes,
  type UIMessage,
  type UIMessageChunk,
  type UITools,
};
