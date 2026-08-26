export const MAX_WEB_SEARCH_CALLS = 3;
export const WEB_SEARCH_TOOL_NAME = "web_search";

type ToolCallStep = {
  toolCalls: ReadonlyArray<{ toolName: string }>;
};

export function getActiveToolsWithinWebSearchLimit(
  toolNames: ReadonlyArray<string>,
  steps: ReadonlyArray<ToolCallStep>,
): string[] {
  const webSearchCalls = steps.reduce(function (count, step) {
    return count + step.toolCalls.filter((toolCall) => toolCall.toolName === WEB_SEARCH_TOOL_NAME).length;
  }, 0);

  if (webSearchCalls < MAX_WEB_SEARCH_CALLS) return [...toolNames];
  return toolNames.filter((toolName) => toolName !== WEB_SEARCH_TOOL_NAME);
}
