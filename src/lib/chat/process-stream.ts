export type StreamTextData = {
  type: "text-delta";
  data: string;
};

export type StreamFirstData = {
  type: "first";
  data: { messageId: string };
};

export type StreamReasoningData = {
  type: "reasoning";
  data: string;
};

export type StreamCustomJsonData<T = Record<string, unknown>> = {
  type: "custom-json";
  data: T;
};

export type StreamEndData = {
  type: "finish";
  data: {
    duration: number;
    finishReason: string;
    totalTokens: number;
    thinkingTokens: number;
  };
};

export type ParsedStreamMessage =
  | StreamFirstData
  | StreamTextData
  | StreamReasoningData
  | StreamCustomJsonData<unknown>
  | StreamEndData;

export type StreamDataHandler = (message: ParsedStreamMessage) => void | Promise<void>;

export function tryParseJson<T>(jsonString: string, context: string): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn(`Failed to parse JSON arguments for ${context}:`, error, `\nString was: ${jsonString}`);
    return {} as T;
  }
}

export async function processChatStream(
  responseBody: ReadableStream<Uint8Array>,
  handler: StreamDataHandler,
): Promise<void> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }); // stream: true is important for multi-byte chars

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (line === "") continue;

        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1 || separatorIndex > 1) {
          console.warn(`Skipping malformed line (no valid prefix): ${line}`);
          continue;
        }

        const prefixStr = line.substring(0, separatorIndex);
        const payloadStr = line.substring(separatorIndex + 1).trim();

        if (payloadStr === "") {
          console.warn(`Skipping line with empty payload: ${line}`);
          continue;
        }

        try {
          let message: ParsedStreamMessage | null = null;

          switch (prefixStr) {
            case "0":
              message = { type: "text-delta", data: unescapeString(payloadStr) };
              break;

            case "g":
              message = { type: "reasoning", data: unescapeString(payloadStr) };
              break;

            case "2":
              message = { type: "custom-json", data: tryParseJson(payloadStr, "custom-json") };
              break;

            case "f":
              message = { type: "first", data: tryParseJson(payloadStr, "first") };
              break;

            case "e":
              message = { type: "finish", data: tryParseJson(payloadStr, "finish") };
              break;

            default:
              console.warn(`Unknown prefix ${prefixStr} for line: ${line}`);
              continue;
          }

          if (message) await handler(message);
        } catch (error) {
          console.error(`Error processing line "${line}":`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error reading from stream:", error);
  } finally {
    if (reader && typeof reader.releaseLock === "function") {
      try {
        reader.releaseLock();
      } catch (e) {
        // The lock might have already been released, e.g. if the stream was cancelled.
        console.warn("Failed to release lock, it might have already been released:", e);
      }
    }
  }
}

function unescapeString(str: string) {
  return str
    .substring(1, str.length - 1)
    .replaceAll("\\n", "\n")
    .replaceAll('\\"', '"');
}
