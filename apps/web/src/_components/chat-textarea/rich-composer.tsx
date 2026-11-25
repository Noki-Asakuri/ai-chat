import { api } from "@ai-chat/backend/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  createTokenInputController,
  fromText,
  toText,
  type Token,
  TokenInput,
  TokenInputEditor,
  TokenInputToken,
  TokenInputTokenRemove,
} from "@ui-sdk/react/token-input";
import {
  type TriggerDefinition,
  type TriggerMenuContentState,
  type TriggerMenuData,
  type TriggerMenuDataGroup,
  type TriggerMenuDataItem,
  TriggerMenu,
  TriggerMenuContent,
  TriggerMenuEmpty,
  TriggerMenuGroup,
  TriggerMenuGroupLabel,
  TriggerMenuHint,
  TriggerMenuItem,
  TriggerMenuItemIcon,
  TriggerMenuList,
} from "@ui-sdk/react/trigger-menu";
import { useConvex } from "convex/react";
import { BrainIcon, CheckIcon, CpuIcon, GlobeIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Icons } from "../ui/icons";
import { toast } from "../ui/toast";

import {
  type ComposerCommandName,
  getComposerCommandName,
  isComposerCommandValue,
  useComposerCommands,
} from "./composer-commands";

import {
  AttachmentGlyph,
  FileChipContent,
  fileChipClassName,
  profileChipClassName,
  tokenChipClassName,
  UploadChipContent,
} from "./token-chip";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import {
  type ComposerAttachment,
  FILE_TOKEN_TYPE,
  getCachedComposerAttachment,
  isChipDeletion,
  PROFILE_TOKEN_TYPE,
  registerComposerController,
  rememberComposerAttachments,
  UPLOAD_TOKEN_TYPE,
} from "@/lib/chat/composer-tokens";
import { tryGetModelData } from "@/lib/chat/models";
import { useGetSendDescription } from "@/lib/chat/send-preference";
import type { UserAttachment } from "@/lib/types";
import { useConfigStore } from "../provider/config-provider";
import { cn, format } from "@/lib/utils";

const ATTACHMENT_SUGGESTION_LIMIT = 8;

export type RichComposerProps = {
  id: string;
  input: string;
  setInput: (content: string) => void;
  model: string;
  /** The files in this composer's tray. Their chips show as chips only while they're here. */
  uploads: ReadonlyArray<UserAttachment>;
  handleAddAttachments: (data: { files: File[] }) => void;
  /**
   * Runs when someone removes chips on purpose, with a chip's remove button or Backspace or Delete,
   * so their files can leave the tray too. Cutting, typing over or undoing a chip leaves its file.
   */
  onRemoveChips?: (tokens: ReadonlyArray<Token>) => void;
  /** Whether a saved file's chip stands for an attached file. Chips that don't show as just their name. */
  isFileAttached?: (attachmentId: string) => boolean;
  onConfirm?: () => void;
  disabled?: boolean;
  enableCommands?: boolean;
  compact?: boolean;
  className?: string;
};

export function RichComposer({
  id,
  input,
  setInput,
  model,
  uploads,
  handleAddAttachments,
  onRemoveChips,
  isFileAttached,
  onConfirm,
  disabled,
  enableCommands = false,
  compact = false,
  className,
}: RichComposerProps) {
  const convexClient = useConvex();
  const pref = useConfigStore((state) => state.pref);
  const [controller] = useState(createTokenInputController);
  const [initialValue] = useState(() => fromText(input));
  const lastEmitted = useRef(input);

  const profilesQuery = useQuery({
    ...convexQuery(api.functions.profiles.listProfiles, {}),
    enabled: enableCommands,
  });
  const profiles = profilesQuery.data ?? [];
  const commands = useComposerCommands();
  const isNarrowScreen = useIsNarrowScreen();

  useEffect(() => registerComposerController(id, controller), [id, controller]);

  // The store also changes outside the editor (send resets it, typing elsewhere appends to it).
  useEffect(() => {
    if (input === lastEmitted.current || input === controller.getText()) return;

    lastEmitted.current = input;
    controller.setValue(fromText(input));
  }, [input, controller]);

  const acceptedTypes = getAcceptedAttachmentTypes(model);

  const triggers: TriggerDefinition[] = [];

  if (enableCommands) {
    const groups: Array<TriggerMenuDataGroup> = [{ type: "group", label: "Commands", items: commands.items }];
    if (profiles.length > 0) {
      groups.push({
        type: "group",
        label: "Profiles",
        items: profiles.map((profile) => ({ value: profile._id, label: profile.name })),
      });
    }

    triggers.push({ char: "/", boundary: "start", type: PROFILE_TOKEN_TYPE, items: groups });
  }

  if (acceptedTypes !== null) {
    triggers.push({
      char: "@",
      type: FILE_TOKEN_TYPE,
      spaces: 2,
      items: async (query, { signal }) => {
        const result = await convexClient.query(api.functions.attachments.listAttachmentsPage, {
          page: 1,
          pageSize: ATTACHMENT_SUGGESTION_LIMIT,
          search: query,
          source: "all",
          type: acceptedTypes,
          sortField: "createdAt",
          sortDirection: "desc",
        });
        if (signal.aborted) throw signal.reason;

        rememberComposerAttachments(result.items);
        return result.items.map((attachment) => ({ value: attachment._id, label: attachment.name }));
      },
    });
  }

  function renderToken(token: Token) {
    if (token.type === PROFILE_TOKEN_TYPE) {
      const profile = profiles.find((item) => item._id === token.value);
      return <ProfileChip label={token.label} imageKey={profile?.imageKey} />;
    }

    if (token.type === FILE_TOKEN_TYPE) {
      if (isFileAttached && !isFileAttached(token.value)) {
        return <TokenInputToken>{token.label}</TokenInputToken>;
      }
      return <FileChip label={token.label} attachment={getCachedComposerAttachment(token.value)} />;
    }

    if (token.type === UPLOAD_TOKEN_TYPE) {
      const upload = uploads.find((attachment) => attachment.id === token.value);
      // A chip whose file left the tray, or was copied from another composer, is only its name.
      if (!upload) {
        return <TokenInputToken>{token.label}</TokenInputToken>;
      }
      return <UploadChip label={token.label} upload={upload} />;
    }

    return <TokenInputToken className={tokenChipClassName}>{token.label}</TokenInputToken>;
  }

  return (
    <div
      className={cn(
        "flex grow flex-row items-start",
        compact
          ? "px-1 pt-2.5 pb-1 group-data-[expanded=false]/composer:max-sm:py-1.5 sm:px-0 sm:pt-2.5"
          : "p-2.5",
      )}
      onPasteCapture={(event) => {
        const files = Array.from(event.clipboardData.items).flatMap((item) => {
          if (item.kind !== "file") return [];
          const file = item.getAsFile();
          return file ? [file] : [];
        });

        if (files.length === 0) return;

        event.preventDefault();
        event.stopPropagation();
        handleAddAttachments({ files });
      }}
    >
      <TokenInput
        controller={controller}
        defaultValue={initialValue}
        copy="label"
        disabled={disabled}
        submitShortcut={pref === "ctrlEnter" ? "mod+enter" : "enter"}
        onSubmit={() => onConfirm?.()}
        onValueChange={(value, details) => {
          const text = toText(value);
          lastEmitted.current = text;
          setInput(text);

          if (!onRemoveChips || !isChipDeletion(details)) return;
          const { removed } = details;
          // Once this change has landed, so removing the file finds its chip already gone.
          queueMicrotask(() => onRemoveChips(removed));
        }}
        getTokenDescription={(token) => {
          if (token.type === PROFILE_TOKEN_TYPE) return "profile";
          if (token.type === FILE_TOKEN_TYPE) return "past file";
          if (token.type === UPLOAD_TOKEN_TYPE) return "attached file";
          return token.type;
        }}
        renderToken={renderToken}
      >
        <TokenInputEditor
          id={id}
          data-composer={id}
          aria-label="Type your message here..."
          aria-describedby="textarea-description"
          placeholder={getPlaceholder({
            commands: enableCommands,
            files: acceptedTypes !== null,
            short: compact && isNarrowScreen,
          })}
          spellCheck
          // The editor stays empty until an input method commits its text, so mark composition
          // ourselves to hide the placeholder under text that is still being composed.
          onCompositionStart={(event) => {
            event.currentTarget.dataset.composing = "";
          }}
          onCompositionEnd={(event) => {
            delete event.currentTarget.dataset.composing;
          }}
          className={cn(
            "relative w-full overflow-y-auto text-sm leading-normal break-words whitespace-pre-wrap caret-primary outline-none",
            // On phones the compact composer starts as one line and grows as you type.
            compact ? "max-h-40 min-h-lh sm:max-h-62.5 sm:min-h-[calc(3lh)]" : "max-h-62.5 min-h-[calc(3lh)]",
            "data-disabled:cursor-not-allowed data-disabled:opacity-50",
            "data-empty:before:pointer-events-none data-empty:before:text-muted-foreground/90 data-empty:before:content-[attr(aria-placeholder)]",
            // Out of the flow, so the caret and typed text start at the left edge instead of after it.
            "before:absolute before:inset-x-0 before:top-0 before:truncate data-composing:before:hidden",
            className,
          )}
        />

        {triggers.length > 0 && (
          <TriggerMenu
            triggers={triggers}
            autoHighlight
            loop
            onSelect={(value, details) => {
              const name = isComposerCommandValue(value) ? getComposerCommandName(value) : null;
              if (!name) return;

              // A command acts on the chat settings; it leaves nothing in the message.
              details.insert("");
              const result = commands.run(name, details.arguments);
              if (result) toast.success(result);
            }}
          >
            <TriggerMenuHint className="pointer-events-none text-muted-foreground/60" />
            <ComposerSuggestions describe={commands.describe} isCurrent={commands.isCurrent} />
          </TriggerMenu>
        )}
      </TokenInput>

      <TextareaDescription />
    </div>
  );
}

type DescribeCommand = (name: ComposerCommandName) => string;
type IsCurrentChoice = (argument: string | null, value: string) => boolean;
type SuggestionHelpers = { describe: DescribeCommand; isCurrent: IsCurrentChoice };

function getSuggestionsHeading(state: TriggerMenuContentState): string | null {
  if (state.argument === "model") return "Choose a model";
  if (state.argument === "effort") return "Choose how much the model reasons";
  if (state.trigger === "@") return "Attach a file you've uploaded before";
  return null;
}

function getEmptyMessage(state: { query: string; loading: boolean }, trigger: string | null): string {
  if (state.loading) return "Looking through your files…";
  if (!state.query) return "Nothing here yet";
  return trigger === "/"
    ? `No command or profile matches “${state.query}”`
    : `Nothing matches “${state.query}”`;
}

function ComposerSuggestions(helpers: SuggestionHelpers) {
  return (
    <TriggerMenuContent
      side="top"
      align="start"
      sideOffset={8}
      collisionPadding={8}
      className={cn(
        "z-50 m-0 flex max-h-[min(20rem,var(--available-height))] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden p-1",
        "rounded-lg border border-border bg-card text-card-foreground shadow-md ring-1 ring-foreground/8",
        "origin-(--transform-origin) duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
      )}
    >
      {(state: TriggerMenuContentState) => (
        <>
          <TriggerMenuList className="flex flex-col gap-0.5 overflow-y-auto aria-busy:opacity-60">
            {(listState) => {
              const heading = getSuggestionsHeading(listState);

              return (
                <>
                  {heading && (
                    <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground" aria-hidden="true">
                      {heading}
                    </p>
                  )}
                  {listState.items.map((entry) => (
                    <SuggestionEntry
                      key={getEntryKey(entry)}
                      entry={entry}
                      state={listState}
                      helpers={helpers}
                    />
                  ))}
                </>
              );
            }}
          </TriggerMenuList>

          <TriggerMenuEmpty className="hidden px-2 py-2 text-xs text-muted-foreground data-empty:block">
            {(emptyState) => (emptyState.empty ? getEmptyMessage(emptyState, state.trigger) : null)}
          </TriggerMenuEmpty>
        </>
      )}
    </TriggerMenuContent>
  );
}

type MenuEntry = TriggerMenuData<unknown>[number];

function getEntryKey(entry: MenuEntry): string {
  if (!(entry instanceof Object)) return entry;
  if ("value" in entry) return String(entry.value);
  if ("label" in entry) return `group:${entry.label ?? ""}`;
  return "separator";
}

function SuggestionEntry({
  entry,
  state,
  helpers,
}: {
  entry: MenuEntry;
  state: TriggerMenuContentState;
  helpers: SuggestionHelpers;
}) {
  if (!(entry instanceof Object)) return null;

  if ("value" in entry) {
    return (
      <ComposerSuggestion
        item={{ value: String(entry.value), label: entry.label }}
        state={state}
        helpers={helpers}
      />
    );
  }

  if (entry.type !== "group") return null;

  return (
    <TriggerMenuGroup className="flex flex-col gap-0.5 not-first:mt-1">
      <TriggerMenuGroupLabel className="px-2 pt-1 pb-0.5 text-xs text-muted-foreground">
        {entry.label}
      </TriggerMenuGroupLabel>
      {entry.items.map((item) =>
        item instanceof Object ? (
          <ComposerSuggestion
            key={String(item.value)}
            item={{ value: String(item.value), label: item.label }}
            state={state}
            helpers={helpers}
          />
        ) : null,
      )}
    </TriggerMenuGroup>
  );
}

type Suggestion = Pick<TriggerMenuDataItem, "value" | "label">;

function ComposerSuggestion({
  item,
  state,
  helpers,
}: {
  item: Suggestion;
  state: TriggerMenuContentState;
  helpers: SuggestionHelpers;
}) {
  const { describe, isCurrent } = helpers;
  const current = isCurrent(state.argument, item.value);
  const attachment = state.trigger === "@" ? getCachedComposerAttachment(item.value) : undefined;
  const commandName = state.trigger === "/" && !state.argument ? getComposerCommandName(item.value) : null;
  const isCommand = commandName !== null && isComposerCommandValue(item.value);

  let icon: React.ReactNode;
  let title: React.ReactNode = item.label;
  let detail: React.ReactNode = null;

  if (state.argument === "model") {
    const provider = tryGetModelData(item.value)?.provider;
    icon = provider ? (
      <Icons.provider provider={provider} className="size-4" />
    ) : (
      <CpuIcon className="size-4" />
    );
  } else if (state.argument === "effort") {
    icon = <BrainIcon className="size-4" />;
  } else if (isCommand) {
    icon =
      commandName === "model" ? (
        <CpuIcon className="size-4" />
      ) : commandName === "effort" ? (
        <BrainIcon className="size-4" />
      ) : (
        <GlobeIcon className="size-4" />
      );
    title = `/${item.label}`;
    detail = describe(commandName);
  } else if (state.trigger === "/") {
    icon = <UserRoundIcon className="size-4" />;
  } else {
    icon = <AttachmentGlyph attachment={attachment} className="size-full" iconClassName="size-4" />;
    if (attachment) {
      detail = `${format.size(attachment.size)}${attachment.thread?.title ? `, from ${attachment.thread.title}` : ""}`;
    }
  }

  return (
    <TriggerMenuItem
      value={item.value}
      label={item.label}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none select-none",
        "data-highlighted:bg-muted/70 data-highlighted:text-foreground data-disabled:opacity-50",
      )}
    >
      <TriggerMenuItemIcon className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {icon}
      </TriggerMenuItemIcon>

      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{title}</span>
        {detail && <span className="truncate text-[0.6875rem] text-muted-foreground">{detail}</span>}
      </span>

      {current && (
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[0.6875rem] text-muted-foreground">
          <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
          Current
        </span>
      )}
    </TriggerMenuItem>
  );
}

function ProfileChip({ label, imageKey }: { label: string; imageKey?: string }) {
  return (
    <TokenInputToken className={profileChipClassName}>
      <Avatar className="size-[1.05em] rounded-full after:rounded-full">
        <AvatarImage src={imageKey ? buildImageAssetUrl(imageKey) : undefined} className="object-cover" />
        <AvatarFallback className="bg-primary/25 text-[0.6em] leading-none">
          {label.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{label}</span>
      <ChipRemove />
    </TokenInputToken>
  );
}

function FileChip({ label, attachment }: { label: string; attachment?: ComposerAttachment }) {
  return (
    <TokenInputToken className={fileChipClassName}>
      <FileChipContent label={label} attachment={attachment} size={attachment?.size} />
      <ChipRemove />
    </TokenInputToken>
  );
}

function UploadChip({ label, upload }: { label: string; upload: UserAttachment }) {
  return (
    <TokenInputToken className={fileChipClassName}>
      <UploadChipContent label={label} upload={upload} />
      <ChipRemove />
    </TokenInputToken>
  );
}

function ChipRemove() {
  return (
    <TokenInputTokenRemove className="-mr-0.5 flex cursor-pointer items-center rounded-sm opacity-60 hover:opacity-100 data-readonly:hidden data-disabled:hidden">
      <XIcon aria-hidden="true" className="size-[0.95em]" />
    </TokenInputTokenRemove>
  );
}

function getAcceptedAttachmentTypes(modelId: string): "all" | "image" | "pdf" | null {
  const inputs = tryGetModelData(modelId)?.modalities.input ?? [];
  const image = inputs.includes("image");
  const pdf = inputs.includes("pdf");

  if (image && pdf) return "all";
  if (image) return "image";
  if (pdf) return "pdf";
  return null;
}

const NARROW_SCREEN_QUERY = "(max-width: 639px)";

function subscribeToNarrowScreen(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribeToNarrowScreen,
    () => window.matchMedia(NARROW_SCREEN_QUERY).matches,
    () => false,
  );
}

function getPlaceholder({
  commands,
  files,
  short,
}: {
  commands: boolean;
  files: boolean;
  short: boolean;
}): string {
  if (short) {
    if (commands && files) return "Message, / commands, @ files";
    if (commands) return "Message, / for commands";
    if (files) return "Message, @ for files";
    return "Message";
  }

  if (commands && files) return "Type your message. / for commands, @ for a past file";
  if (commands) return "Type your message. / for commands";
  if (files) return "Type your message. @ for a past file";
  return "Type your message here...";
}

function TextareaDescription() {
  const sendDescription = useGetSendDescription();

  return (
    <span id="textarea-description" className="sr-only">
      {sendDescription}
    </span>
  );
}
