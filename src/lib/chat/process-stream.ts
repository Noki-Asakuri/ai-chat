import type { UIMessageChunk } from "ai";

import { tryCatch } from "../utils";

export type StreamDataHandler = (message: UIMessageChunk) => void | Promise<void>;

export function tryParseJson<T>(jsonString: string, context: string): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn(
      `Failed to parse JSON arguments for ${context}:`,
      error,
      `\nString was: ${jsonString}`,
    );
    return {} as T;
  }
}

export async function processChatStream({
  fetch,
  handler,
}: {
  fetch: Promise<Response>;
  handler: StreamDataHandler;
}) {
  const response = await fetch;

  if (!response.ok) {
    let error: string;
    const textRes = response.clone();

    const [jsonResult] = await tryCatch(textRes.json() as Promise<{ error: { message: string } }>);

    if (jsonResult) {
      error = jsonResult.error.message;
    } else {
      const text = await textRes.text();
      error = text || "Unknown error. Failed to get error message.";
    }

    throw new Error(`Failed to fetch: ${response.status} - ${error}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (line === "") continue;

        if (!line.startsWith("data: ")) {
          console.warn(`[Stream] Skipping malformed line (no "data: " prefix): ${line}`);
          continue;
        }

        if (line === "data: [DONE]") {
          console.debug("[Stream] Stream finished");
          continue;
        }

        const payloadStr = line.substring("data: ".length).trim();
        if (payloadStr === "") {
          console.warn(`[Stream] Skipping line with empty payload: ${line}`);
          continue;
        }

        const payload = tryParseJson<UIMessageChunk>(payloadStr, "stream data");
        if (!payload.type) {
          console.warn(`[Stream] Skipping malformed line (no type): ${line}`);
          continue;
        }

        await handler(payload);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.debug("[Stream] Chat request aborted:", error.message);
      return;
    }

    console.error("Error reading from stream:", error);
  } finally {
    if (reader && typeof reader.releaseLock === "function") {
      try {
        reader.releaseLock();
      } catch (e) {
        // The lock might have already been released, e.g. if the stream was cancelled.
        console.warn("[Stream] Failed to release lock, it might have already been released:", e);
      }
    }
  }
}
