import { api } from "@ai-chat/backend/convex/_generated/api";

import dedent from "dedent";
import type { Context } from "hono";

import { createServerConvexClient } from "@/libs/convex";
import type { ChatMetadata } from "../types";

type PromptSection = {
  tag: string;
  title: string;
  body: string;
  enabled?: boolean;
};

function formatPromptSection(section: PromptSection) {
  if (section.enabled === false) return null;

  const body = section.body.trim();
  if (body.length === 0) return null;

  return dedent`
    <${section.tag}>
    ## ${section.title}:
    ${body}
    </${section.tag}>
  `;
}

function joinPromptSections(sections: Array<PromptSection>) {
  const formattedSections: Array<string> = [];

  for (const section of sections) {
    const formattedSection = formatPromptSection(section);
    if (formattedSection) formattedSections.push(formattedSection);
  }

  return formattedSections.join("\n\n").trim();
}

export async function buildSystemPrompts(ctx: Context, metadata: ChatMetadata) {
  const convexClient = await createServerConvexClient(ctx);
  const profileId = metadata.modelParams.profile ?? null;

  const userPreferencesPromise = convexClient.query(
    api.functions.users.getCurrentUserPreferences,
    {},
  );

  const profilePromise = profileId
    ? convexClient.query(api.functions.profiles.getProfile, { profileId })
    : null;

  const [userPreferences, profile] = await Promise.all([userPreferencesPromise, profilePromise]);

  return joinPromptSections([
    {
      tag: "user",
      title: "User Information",
      body: dedent`
        User basic information. Avoid mentioning the user's name during the conversation.
        Keep it in mind and use it when necessary.

        Name: ${userPreferences.name}
      `,
    },
    {
      tag: "global",
      title: "Global System Instruction",
      body: dedent`
        This is the global system instruction. It should be followed unless there is a conflicting instruction in the AI Profile Instruction.

        ${userPreferences.globalSystemInstruction}
      `,
    },
    {
      tag: "profile",
      title: "AI Profile Instruction",
      enabled: Boolean(profile?.systemPrompt.trim()),
      body: dedent`
        User defined instruction. This is the most important instruction. It should take precedence over the global system instruction.

        ${profile?.systemPrompt ?? ""}
      `,
    },
    {
      tag: "math",
      title: "Math Formatting Instruction",
      body: dedent`
        When the user asks a math question, format mathematical expressions using LaTeX delimiters.
        - Supported inline math delimiters: $...$ and \(...\).
        - Supported block math delimiters: $$...$$ and \[...\].
        - Prefer $...$ for inline math and $$...$$ for block math.

        When using single dollar sign delimiters, make sure there is a space between the delimiters and the expression.
        For example, use $ x = 1 $ instead of $x = 1$.

        To avoid making currency symbols into math, add an escape character before the dollar sign.
        For example, use \$40 instead of $40 and 100\$ instead of 100$.
      `,
    },
    {
      tag: "code",
      title: "Code Block Update Instruction",
      body: dedent`
        - If the user provides code in a fenced code block and you update that code, you must return the updated code inside a fenced code block.
        - Never place a fenced code block inside another fenced code block. If you need to show a fence marker inside code, use an indented example or plain text instead.
      `,
    },
    {
      tag: "web-search",
      title: "Web Search Instruction",
      enabled: metadata.modelParams.webSearch,
      body: dedent`
        - Use one language only for web search in this request. Prefer the same language as the user's latest message unless the user explicitly asks for a different language.
        - Do not run multilingual web searches for the same intent.
        - Avoid multiple web search tool calls in the same step because they can return duplicate or overlapping results.
        - If a previous step already contains enough web search context, do not search again.
        - Only call web search again when prior results are clearly insufficient, outdated, or not relevant enough to answer reliably.
      `,
    },
  ]);
}
