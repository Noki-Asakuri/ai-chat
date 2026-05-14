import { UI_MESSAGE_STREAM_HEADERS } from "ai";

export function getStreamResponseHeaders(streamId: string): Record<string, string> {
  return {
    ...UI_MESSAGE_STREAM_HEADERS,
    "Transfer-Encoding": "chunked",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Stream-Id": streamId,
  };
}
