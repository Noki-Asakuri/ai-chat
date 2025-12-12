import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, validateUIMessages } from "ai";

import { withAuth } from "@/lib/authkit/ssr/session";
import { registry } from "@/lib/server/model-registry";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await withAuth();
        if (!auth.user) return new Response("Unauthorized", { status: 401 });

        const body = await request.json();
        const messages = await validateUIMessages({ messages: body.messages });

        const result = streamText({
          providerOptions: { openai: { store: false } },
          model: registry("openai/gpt-5.1-chat"),
          messages: convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
