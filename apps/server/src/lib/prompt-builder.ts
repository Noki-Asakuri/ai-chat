import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";
import type { UserPreferences } from "@ai-chat/backend/convex/functions/users";

import dedent from "dedent";

type BuildSystemInstructionOptions = {
  webSearchEnabled?: boolean;
};

export async function buildSystemInstruction(
  userPreferences: UserPreferences,
  profile: Doc<"profiles"> | null,
  options: BuildSystemInstructionOptions = {},
) {
  const systemInstruction: string[] = [];

  systemInstruction.push(dedent`
		<user>
		## User Information:
		User basic information. Avoid mentioning the user's name during the conversation.
		Keep it in mind and use it when necessary.

		Name: ${userPreferences.name ?? "user"}
		</user>
		`);

  systemInstruction.push(dedent`
		<global>
		## Global System Instruction:
		This is the global system instruction. It should be followed unless there is a conflicting instruction in the AI Profile Instruction.

		${userPreferences.globalSystemInstruction ?? "You are a helpful assistant."}
		</global>
		`);

  if (profile && profile.systemPrompt.length > 0) {
    systemInstruction.push(dedent`
			<profile>
			## AI Profile Instruction:
			User defined instruction. This is the most important instruction. It should take precedence over the global system instruction.

			${profile.systemPrompt}
			</profile>
			`);
  }

  systemInstruction.push(dedent`
		<math>
		## Math Formatting Instruction:
		When the user asks a math question, format mathematical expressions using LaTeX delimiters.
		- Supported inline math delimiters: $...$ and \(...\).
		- Supported block math delimiters: $$...$$ and \[...\].
		- Prefer $...$ for inline math and $$...$$ for block math.

		When using single dollar sign delimiters, make sure there is a space between the delimiters and the expression.
		For example, use $ x = 1 $ instead of $x = 1$.

		To avoid making currency symbols into math, add a espace character before the dollar sign.
		For example, use \$40 instead of $40 and 100\$ instead of 100$
		</math>
		`);

  systemInstruction.push(dedent`
		<code>
		## Code Block Update Instruction:
		- If the user provides code in a fenced code block and you update that code, you must return the updated code inside a fenced code block.
		- Never place a fenced code block inside another fenced code block. If you need to show a fence marker inside code, use an indented example or plain text instead.
		</code>
		`);

  if (options.webSearchEnabled) {
    systemInstruction.push(dedent`
			<web-search>
			## Web Search Instruction:
			- Use one language only for web search in this request. Prefer the same language as the user's latest message unless the user explicitly asks for a different language.
			- Do not run multilingual web searches for the same intent.
			- Avoid multiple web search tool calls in the same step because they can return duplicate or overlapping results.
			- If a previous step already contains enough web search context, do not search again.
			- Only call web search again when prior results are clearly insufficient, outdated, or not relevant enough to answer reliably.
			</web-search>
			`);
  }

  return systemInstruction.join("\n\n").trim();
}
