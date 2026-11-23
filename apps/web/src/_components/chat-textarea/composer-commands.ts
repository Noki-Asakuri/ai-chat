import type { TriggerMenuDataItem } from "@ui-sdk/react/trigger-menu";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "../provider/config-provider";

import { compareModelLabelsNewestFirst } from "./model-selector-utils";
import { REASONING_OPTIONS } from "./reasoning-options";

import { getReasoningOptions, SelectableModelIds, tryGetModelData } from "@/lib/chat/models";
import { useChangeChatModel, useSetChatEffort, useSetChatWebSearch } from "@/lib/chat/use-chat-settings";
import type { ReasoningEffort } from "@/lib/types";

const COMMAND_VALUE_PREFIX = "command:";

export type ComposerCommandName = "model" | "effort" | "search";

export function isComposerCommandValue(value: string): boolean {
  return value.startsWith(COMMAND_VALUE_PREFIX);
}

export function getComposerCommandName(value: string): ComposerCommandName | null {
  const name = value.slice(COMMAND_VALUE_PREFIX.length);
  return name === "model" || name === "effort" || name === "search" ? name : null;
}

export function getModelLabel(modelId: string): string {
  const data = tryGetModelData(modelId);
  return data ? (data.display.unique ?? data.display.name) : modelId;
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return Object.hasOwn(REASONING_OPTIONS, value);
}

export function useComposerCommands() {
  const { model, effort, webSearch, hiddenModels } = useConfigStore(
    useShallow((state) => ({
      model: state.model,
      effort: state.modelParams.effort,
      webSearch: state.modelParams.webSearch,
      hiddenModels: state.hiddenModels,
    })),
  );
  const changeChatModel = useChangeChatModel();
  const setChatEffort = useSetChatEffort();
  const setChatWebSearch = useSetChatWebSearch();

  const modelData = tryGetModelData(model);
  const efforts = modelData ? getReasoningOptions(modelData) : [];
  const supportsWebSearch = modelData?.capabilities.toolCalling ?? false;

  const hidden = new Set(hiddenModels);
  const models = SelectableModelIds.flatMap((id) => {
    const data = tryGetModelData(id);
    if (!data || hidden.has(id)) return [];
    return [{ value: id, label: getModelLabel(id), keywords: [id, data.provider] }];
  }).toSorted(compareModelLabelsNewestFirst);

  const items: TriggerMenuDataItem[] = [
    {
      value: `${COMMAND_VALUE_PREFIX}model`,
      label: "model",
      keywords: ["switch"],
      arguments: [{ name: "model", hint: "<model>", required: true, allowCustomValue: false, items: models }],
    },
  ];

  if (efforts.length > 0) {
    items.push({
      value: `${COMMAND_VALUE_PREFIX}effort`,
      label: "effort",
      keywords: ["reasoning", "thinking"],
      arguments: [
        {
          name: "effort",
          hint: "<level>",
          required: true,
          allowCustomValue: false,
          items: efforts.map((level) => ({ value: level, label: REASONING_OPTIONS[level].label })),
        },
      ],
    });
  }

  if (supportsWebSearch) {
    items.push({ value: `${COMMAND_VALUE_PREFIX}search`, label: "search", keywords: ["web"] });
  }

  function describe(name: ComposerCommandName): string {
    if (name === "model") return `Switch from ${getModelLabel(model)}`;
    if (name === "effort") return "Set how much the model reasons";
    return webSearch ? "Turn web search off" : "Turn web search on";
  }

  // Returns what changed, for a short confirmation, or null when the arguments don't apply.
  function run(name: ComposerCommandName, args: Record<string, string>): string | null {
    if (name === "model") {
      const next = args.model;
      if (!next || !tryGetModelData(next)) return null;
      changeChatModel(next);
      return `Switched to ${getModelLabel(next)}`;
    }

    if (name === "effort") {
      const next = args.effort;
      if (!next || !isReasoningEffort(next) || !efforts.includes(next)) return null;
      setChatEffort(next);
      return `Reasoning effort set to ${REASONING_OPTIONS[next].label}`;
    }

    setChatWebSearch(!webSearch);
    return webSearch ? "Web search off" : "Web search on";
  }

  function isCurrent(argument: string | null, value: string): boolean {
    return (argument === "model" && value === model) || (argument === "effort" && value === effort);
  }

  return { items, describe, run, isCurrent };
}
