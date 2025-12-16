import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vercel/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).pathname.replace("/api/vercel", "");
        const response = await fetch(`https://chat.asakuri.me/_vercel/${path}`);

        return new Response(response.body, {
          status: response.status,
          headers: {
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=2678400",
            "cross-origin-resource-policy": "cross-origin",

            "content-type": response.headers.get("content-type")!,
            "content-disposition": response.headers.get("content-disposition")!,
          },
        });
      },
    },
  },
});
