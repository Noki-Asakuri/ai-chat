import { tool } from "ai";
import { z } from "zod/v4";

import { env } from "@/env";

const exaSearchResponseSchema = z.looseObject({
  requestId: z.string().optional(),
  resolvedSearchType: z.string().optional(),
  results: z.array(
    z.looseObject({
      id: z.string().optional(),
      title: z.string(),
      url: z.string(),
      publishedDate: z.string().optional(),
      author: z.string().nullish(),
      image: z.string().optional(),
      favicon: z.string().optional(),
      text: z.string().optional(),
      highlights: z.array(z.string()).optional(),
      highlightScores: z.array(z.number()).optional(),
      summary: z.string().optional(),
    }),
  ),
});

export const webSearch = tool({
  description:
    "Search the web for current information, news, articles, documentation, and other up-to-date facts.",
  inputSchema: z.object({
    query: z.string().min(1).max(500).describe("The web search query"),
  }),
  execute: async function ({ query }) {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.EXA_API_KEY,
        "x-exa-integration": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 10,
        contents: { text: { maxCharacters: 1_500 }, livecrawl: "fallback", livecrawlTimeout: 10_000 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Exa API request failed with status ${response.status}`);
    }

    return exaSearchResponseSchema.parse(await response.json());
  },
});
