import { api } from "@ai-chat/backend/convex/_generated/api";
import type { UserPreferencesPatch } from "@ai-chat/backend/convex/functions/users";
import type { ReasoningEffort } from "@ai-chat/shared/chat/metadata";
import { getModelData, resolveReasoning } from "@ai-chat/shared/chat/models";
import { DEFAULT_GENERAL_SETTINGS } from "@ai-chat/shared/chat/preferences";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";

import { ModelSelector } from "@/components/chat-textarea/model-selector";
import { ReasoningPicker } from "@/components/chat-textarea/reasoning-picker";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

import { AutoSettleThreadsCard } from "../-components/account/auto-settle-threads-card";
import { AutosaveStatus } from "../-components/autosave-status";

export const Route = createFileRoute("/settings/general")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...convexQuery(api.functions.users.getCurrentUserPreferences),
      staleTime: "static",
    });
  },
  component: GeneralSettings,
  head: () => ({ meta: [{ title: "General - AI Chat" }] }),
});

const confirmations = [
  {
    key: "unpin",
    label: "Unpin confirmation",
    description: "Ask before removing threads from the pinned section.",
  },
  {
    key: "settle",
    label: "Settle confirmation",
    description: "Require a second click before settling a thread in the sidebar.",
  },
  {
    key: "delete",
    label: "Delete confirmation",
    description:
      "Ask before deleting a thread and its chat history. Attachments are kept when confirmation is off.",
  },
] as const;

function GeneralSettings() {
  const { data: preferences } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const updatePreferences = useMutation(api.functions.users.updateUserPreferences);
  const [saving, startSaving] = useTransition();

  function save(data: UserPreferencesPatch) {
    startSaving(async () => {
      try {
        await updatePreferences({ data });
      } catch (error) {
        toast.error("Failed to save settings", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  const textGeneration = preferences.textGeneration ?? DEFAULT_GENERAL_SETTINGS.textGeneration;
  const confirmationSettings = preferences.confirmations ?? DEFAULT_GENERAL_SETTINGS.confirmations;

  return (
    <ConfigStoreProvider
      initialState={{
        hiddenModels: preferences.models.hidden,
        favoriteModels: preferences.models.favorite,
      }}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Changes save automatically and sync across your devices.
          </p>
          <AutosaveStatus isSaving={saving} />
        </div>
        <SettingsSection
          id="new-chats"
          title="New chats"
          description="Choose how every new conversation starts."
        >
          <FieldGroup className="gap-0 divide-y rounded-xl border px-5">
            <ModelDefaults
              id="default-model"
              label="Default model"
              description="Used for new chats. Changing a chat’s model only affects that chat."
              model={preferences.models.defaultModel}
              effort={preferences.models.modelParams.effort}
              disabled={saving}
              onChange={(model, effort) => save({ models: { defaultModel: model, modelParams: { effort } } })}
            />
            <Field className="grid items-center gap-4 py-5 sm:grid-cols-[1fr_auto]">
              <FieldContent>
                <FieldLabel htmlFor="default-web-search">Web search</FieldLabel>
                <FieldDescription>
                  Enable web search by default for models that support tools.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="default-web-search"
                checked={preferences.models.modelParams.webSearch}
                disabled={saving}
                onCheckedChange={(webSearch) => save({ models: { modelParams: { webSearch } } })}
              />
            </Field>
          </FieldGroup>
        </SettingsSection>
        <SettingsSection
          id="text-generation"
          title="Text generation"
          description="Choose a separate model for generated chat titles."
        >
          <FieldGroup className="gap-0 rounded-xl border px-5">
            <ModelDefaults
              id="text-model"
              label="Text generation model"
              description="Used for automatic titles and when you regenerate a title."
              model={textGeneration.model}
              effort={textGeneration.effort}
              disabled={saving}
              textOnly
              onChange={(model, effort) => save({ textGeneration: { model, effort } })}
            />
          </FieldGroup>
        </SettingsSection>
        <SettingsSection id="confirmations" title="Confirmations">
          <FieldGroup className="gap-0 divide-y rounded-xl border px-5">
            {confirmations.map(({ key, label, description }) => (
              <Field key={key} className="grid items-center gap-4 py-5 sm:grid-cols-[1fr_auto]">
                <FieldContent>
                  <FieldLabel htmlFor={`confirm-${key}`}>{label}</FieldLabel>
                  <FieldDescription>{description}</FieldDescription>
                </FieldContent>
                <Switch
                  id={`confirm-${key}`}
                  checked={confirmationSettings[key]}
                  disabled={saving}
                  onCheckedChange={(checked) => save({ confirmations: { [key]: checked } })}
                />
              </Field>
            ))}
          </FieldGroup>
        </SettingsSection>
        <AutoSettleThreadsCard
          key={preferences.threads?.autoSettleDays ?? 0}
          disabled={saving}
          initialDays={preferences.threads?.autoSettleDays ?? 0}
        />
        <div className="flex justify-end border-t pt-5">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() =>
              save({
                models: {
                  defaultModel: DEFAULT_GENERAL_SETTINGS.models.defaultModel,
                  modelParams: {
                    effort: DEFAULT_GENERAL_SETTINGS.models.modelParams.effort,
                    webSearch: DEFAULT_GENERAL_SETTINGS.models.modelParams.webSearch,
                  },
                },
                textGeneration: DEFAULT_GENERAL_SETTINGS.textGeneration,
                confirmations: DEFAULT_GENERAL_SETTINGS.confirmations,
                threads: DEFAULT_GENERAL_SETTINGS.threads,
              })
            }
          >
            <RotateCcwIcon data-icon="inline-start" /> Restore general defaults
          </Button>
        </div>
      </div>
    </ConfigStoreProvider>
  );
}

function ModelDefaults(props: {
  id: string;
  label: string;
  description: string;
  model: string;
  effort: ReasoningEffort;
  disabled: boolean;
  textOnly?: boolean;
  onChange: (model: string, effort: ReasoningEffort) => void;
}) {
  const model = getModelData(props.model);
  const effort = resolveReasoning(model, props.effort);

  return (
    <Field className="grid items-center gap-4 py-5 lg:grid-cols-[1fr_auto]">
      <FieldContent>
        <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
        <FieldDescription id={`${props.id}-description`}>{props.description}</FieldDescription>
      </FieldContent>
      <div className="flex flex-wrap gap-2">
        <ModelSelector
          value={props.model}
          triggerId={props.id}
          disabled={props.disabled}
          textOnly={props.textOnly}
          onChange={(value) => props.onChange(value, resolveReasoning(getModelData(value), effort))}
        />
        <ReasoningPicker
          model={props.model}
          value={effort}
          disabled={props.disabled}
          ariaLabel={`${props.label} reasoning effort`}
          onChange={(value) => props.onChange(props.model, value)}
        />
      </div>
    </Field>
  );
}
