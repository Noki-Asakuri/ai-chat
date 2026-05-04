# Chat route reimplementation checklist

This checklist tracks the core chat route behavior that has already been
restored and the behavior that still needs to be reimplemented after moving the
old `apps/server/src/routes/ai-chat.ts` functionality into
`apps/server/src/routes/api.ai.chat.ts`.

## Progress summary

Current progress is **19 of 46 items complete**.

- Restored: 19 items.
- Top core features remaining: 18 items.
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

## Top core features still missing

These items are high-priority because they affect correctness, user-visible
behavior, billing or usage accounting, persistence, and stream recovery.

- [ ] Restore usage refunds on stream, provider, or fatal errors with
  `api.functions.usages.refundRequest`.
- [ ] Wrap the POST `/chat` handler in a fatal `try/catch`.
- [ ] Add `onError` to the stream response.
- [ ] Persist stream and provider failures with
  `api.functions.messages.updateErrorMessage`.
- [ ] Return safe provider and client messages from stream errors.
- [ ] Add provider error logging for AI SDK provider failures.
- [ ] Restore `activeStreamId = validatedBody.streamId ?? requestId`.
- [ ] Use `activeStreamId` consistently for stream headers, Redis stream keys,
  resume IDs, and message `resumableStreamId`.
- [ ] Restore abort request body validation with `streamId`, `threadId`,
  `assistantMessageId`, `parts`, and optional `metadata`.
- [ ] Restore abort persistence by saving partial parts, marking the message
  complete, and clearing the resumable stream ID.
- [ ] Set aborted metadata `finishReason: "aborted"`.
- [ ] Trigger `trackFinishedMessageById` after finished messages when
  `updateFinishedMessageById` returns `true`.
- [ ] Restore generated file handling from agent results.
- [ ] Upload generated files to R2 or the new equivalent file storage path.
- [ ] Patch generated file part URLs before persisting parts.
- [ ] Store generated attachment IDs on the finished assistant message.
- [ ] Restore `finalizeStreamParts` behavior before saving parts.
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
- [ ] Add `experimental_download` support back to `buildChatAgent` if file
  caching or download behavior is still needed.
- [ ] Recreate the old file input caching helper or replace it with the new
  storage path.
- [ ] Fix the abort route method if the client still expects
  `POST /api/ai/chat/abort`.
- [ ] Fix typo: `Missing ststreamTextreamId`.
- [ ] Remove the unnecessary `as Id<"messages">` in `onFinish` because
  `validatedBody.assistantMessageId` is already typed.
- [ ] Rename `errorResposne` to `errorResponse`.
- [ ] Replace `_tag` checks with `StreamNotFoundError.is(...)` or a consistent
  error matcher if preferred.
