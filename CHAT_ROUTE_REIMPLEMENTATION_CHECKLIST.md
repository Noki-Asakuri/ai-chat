# Chat route reimplementation checklist

This checklist tracks the core chat route behavior that has already been
restored and the behavior that still needs to be reimplemented after moving the
old `apps/server/src/routes/ai-chat.ts` functionality into
`apps/server/src/routes/api.ai.chat.ts`.

## Progress summary

Current progress is **33 of 48 items complete**.

- Restored: 33 items.
- Top core features remaining: 6 items.
- Important but secondary items remaining: 9 items.

## Already restored

These items are present in the current implementation or covered by the new
helper files.

- [x] POST body is read once in `api.ai.chat.ts`.
- [x] Validation errors are mapped to client-friendly messages through
      `getValidationErrorResponse`.
- [x] `buildChatAgent` exists in
      `apps/server/src/libs/ai/agents/index.ts`.
- [x] The route uses `buildChatAgent`.
- [x] The route uses the selected model from `validatedBody.model.id`.
- [x] The route passes `validatedBody.tools`.
- [x] The route passes `validatedBody.providerOptions`.
- [x] The Redis stream client supports create, resume, cancel, replay, TTL, and
      user-scoped stream keys.
- [x] `updateFinishedMessageById` sets `status: "complete"` and
      `resumableStreamId: null` internally.
- [x] The route builds a real `systemInstruction` with `buildSystemPrompts`.
- [x] User preferences are loaded with
      `api.functions.users.getCurrentUserPreferences`.
- [x] Optional profiles are loaded with `api.functions.profiles.getProfile`.
- [x] A system prompt helper exists at
      `apps/server/src/libs/ai/agents/build-system-prompt.ts`.
- [x] Web search instructions are conditionally included through
      `metadata.modelParams.webSearch`.
- [x] A dedicated AI limits helper exists at `apps/server/src/libs/ai/limits.ts`.
- [x] Usage limit checks call `api.functions.usages.checkAndIncrement`.
- [x] The route returns `429` when the usage limit is reached.
- [x] Usage-limit errors are persisted through
      `api.functions.messages.updateErrorMessage`.
- [x] The stream client now publishes cancellation to the producer and exposes
      an abort signal for stream shutdown.
- [x] Stream response now includes `onError`.
- [x] Stream response now returns safe provider and client error messages.
- [x] Server-generated `requestId` is used as the active stream ID for stream
      headers, Redis stream keys, resume IDs, and message `resumableStreamId`.
- [x] Abort route accepts `POST /api/ai/chat/abort` with the server-issued
      stream ID as a query parameter.
- [x] Abort persistence is handled by stream shutdown and `onFinish`, instead
      of resending partial message payloads from the client.
- [x] Aborted messages set metadata `finishReason: "aborted"`.
- [x] Finished messages trigger `trackFinishedMessageById` when
      `updateFinishedMessageById` returns `true`.
- [x] `buildChatAgent` wires `experimental_download` to the Redis file cache.
- [x] The Redis file caching helper stores downloaded file buffers and media
      types with a TTL.
- [x] Generated file handling from agent results is restored.
- [x] Generated files are uploaded to R2 through the server-side file helper.
- [x] Generated file part URLs are patched before persisted parts are saved.
- [x] Generated attachment IDs are stored on the finished assistant message.
- [x] `finalizeStreamParts` behavior is restored before saving parts.

## Top core features still missing

These items are high-priority because they affect correctness, user-visible
behavior, billing or usage accounting, persistence, and stream recovery.

- [ ] Restore usage refunds on stream, provider, or fatal errors with
      `api.functions.usages.refundRequest`.
- [ ] Wrap the POST `/chat` handler in a fatal `try/catch`.
- [ ] Persist stream and provider failures with
      `api.functions.messages.updateErrorMessage`.
- [ ] Add provider error logging for AI SDK provider failures.
- [ ] Pass `originalMessages: validatedBody.messages` to
      `toUIMessageStreamResponse`.
- [ ] Make stream setup fail loudly or explicitly handle `Promise.allSettled`
      failures.

## Important but secondary

These items are useful to restore, but they are less critical than the core
runtime, persistence, and accounting behavior above.

- [ ] Restore background thread title updates after chat starts.
- [ ] Decide whether title generation should call the existing
      `generateThreadTitle` directly or use a new helper that updates Convex.
- [ ] Restore the resume guard against Convex message state if it's still
      needed. Current Redis ownership guard exists, but no database
      `canResumeStream` equivalent was found.
- [ ] Verify the Redis file caching helper handles missing or unexpected
      `content-type` headers without throwing unexpectedly.
- [ ] Verify the Redis file caching key normalization cannot collide for nested
      attachment paths.
- [ ] Verify the abort route no longer needs request body validation because
      partial persistence now happens through stream shutdown.
- [ ] Verify the client no longer creates fallback stream IDs when
      `X-Stream-Id` is missing.
- [ ] Rename `errorResposne` to `errorResponse`.
- [ ] Replace `_tag` checks with `StreamNotFoundError.is(...)` or a consistent
      error matcher if preferred.
