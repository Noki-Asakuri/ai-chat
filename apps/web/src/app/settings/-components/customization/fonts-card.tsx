import { ChevronDownIcon, LockKeyholeIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { startTransition, useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";

import { Button } from "@/components/ui/button";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

const SUPPORTED_FONTS = ["JetBrains Mono", "Space Grotesk"];
const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20];
const MAX_VISIBLE_FONTS = 75;
const FONT_ACCESS_STORAGE_KEY = "ai-chat:local-font-access";
const DEVICE_FONTS_STORAGE_KEY = "ai-chat:device-font-families";
const CODE_PREVIEW = `type User = {
  name: string;
  email: string;
};

export function formatUser(user: User) {
  const displayName = user.name.trim();
  return \`${"${displayName}"} <${"${user.email}"}>\`;
}`;

type FontAccessStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export type FontsCardProps = {
  disabled: boolean;
  uiFont: string;
  uiFontSize: number;
  promptFont: string;
  promptFontSize: number;
  codeFont: string;
  codeFontSize: number;
  onUiFontChange: (font: string) => void;
  onUiFontSizeChange: (size: number) => void;
  onPromptFontChange: (font: string) => void;
  onPromptFontSizeChange: (size: number) => void;
  onCodeFontChange: (font: string) => void;
  onCodeFontSizeChange: (size: number) => void;
};

export function FontsCard(props: FontsCardProps) {
  const [deviceFonts, setDeviceFonts] = useState<string[]>([]);
  const [fontAccessStatus, setFontAccessStatus] = useState<FontAccessStatus>("idle");

  const availableFonts = [...new Set([...SUPPORTED_FONTS, ...deviceFonts])].sort((left, right) =>
    left.localeCompare(right),
  );

  async function queryDeviceFonts(showFeedback: boolean) {
    const queryLocalFonts = window.queryLocalFonts;
    if (!queryLocalFonts) {
      window.localStorage.setItem(FONT_ACCESS_STORAGE_KEY, "unavailable");
      setFontAccessStatus("unavailable");
      if (showFeedback) toast.error("Device font access is not supported in this browser.");
      return;
    }

    setFontAccessStatus("requesting");

    try {
      const localFonts = await queryLocalFonts.call(window);
      const families: string[] = [];
      for (const font of localFonts) {
        const family = font.family.trim();
        if (family.length > 0) families.push(family);
      }

      const nextDeviceFonts = [...new Set(families)].sort((left, right) => left.localeCompare(right));
      window.localStorage.setItem(FONT_ACCESS_STORAGE_KEY, "granted");
      window.localStorage.setItem(DEVICE_FONTS_STORAGE_KEY, JSON.stringify(nextDeviceFonts));
      setDeviceFonts(nextDeviceFonts);
      setFontAccessStatus("granted");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        window.localStorage.setItem(FONT_ACCESS_STORAGE_KEY, "denied");
        setFontAccessStatus("denied");
        if (showFeedback) {
          toast.error("Device font access was denied", {
            description: "Only fonts bundled with AI Chat are available.",
          });
        }
        return;
      }

      window.localStorage.setItem(FONT_ACCESS_STORAGE_KEY, "unavailable");
      setFontAccessStatus("unavailable");
      if (showFeedback) {
        toast.error("Unable to read device fonts", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  }

  useEffect(() => {
    const storedAccess = window.localStorage.getItem(FONT_ACCESS_STORAGE_KEY);
    const storedFonts = window.localStorage.getItem(DEVICE_FONTS_STORAGE_KEY);

    if (storedFonts) {
      try {
        const parsedFonts: unknown = JSON.parse(storedFonts);
        if (Array.isArray(parsedFonts)) {
          const validFonts: string[] = [];
          for (const font of parsedFonts) {
            if (typeof font === "string" && font.trim().length > 0) validFonts.push(font);
          }
          setDeviceFonts([...new Set(validFonts)]);
        }
      } catch {
        window.localStorage.removeItem(DEVICE_FONTS_STORAGE_KEY);
      }
    }

    if (storedAccess === "granted") {
      setFontAccessStatus("granted");
      return;
    }

    if (storedAccess === "denied" || storedAccess === "unavailable") {
      setFontAccessStatus(storedAccess);
    }
  }, []);

  let accessDescription = "AI Chat asks once to include fonts installed on this device.";
  if (fontAccessStatus === "requesting") {
    accessDescription = "Checking for fonts installed on this device…";
  } else if (fontAccessStatus === "granted") {
    accessDescription = `${deviceFonts.length} device font${deviceFonts.length === 1 ? "" : "s"} available.`;
  } else if (fontAccessStatus === "denied") {
    accessDescription = "Access was denied. Only fonts bundled with AI Chat are shown.";
  } else if (fontAccessStatus === "unavailable") {
    accessDescription = "Device font access is unavailable. Only fonts bundled with AI Chat are shown.";
  }

  return (
    <section aria-labelledby="typography-heading" className="flex flex-col">
      <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="typography-heading" className="text-lg font-semibold tracking-tight">
            Typography
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Tune interface, prompt, and code text independently.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyholeIcon className="size-4 shrink-0" />
            <span>{accessDescription}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={props.disabled || fontAccessStatus === "requesting"}
            onClick={() => void queryDeviceFonts(true)}
          >
            {fontAccessStatus === "requesting" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {fontAccessStatus === "idle"
              ? "Allow fonts"
              : fontAccessStatus === "granted"
                ? "Refresh"
                : "Try again"}
          </Button>
        </div>
      </div>

      <FieldGroup className="gap-0">
        <FontSelector
          id="ui-font"
          label="Interface font"
          description="Used for navigation, controls, and conversation text."
          value={props.uiFont}
          size={props.uiFontSize}
          fonts={availableFonts}
          disabled={props.disabled}
          onFontChange={props.onUiFontChange}
          onSizeChange={props.onUiFontSizeChange}
        />
        <Separator />
        <FontSelector
          id="prompt-font"
          label="Prompt font"
          description="Used only in the box where you write prompts."
          value={props.promptFont}
          size={props.promptFontSize}
          fonts={availableFonts}
          disabled={props.disabled}
          onFontChange={props.onPromptFontChange}
          onSizeChange={props.onPromptFontSizeChange}
        >
          <div
            className="rounded-lg border bg-background px-4 py-3 text-pretty text-foreground shadow-xs"
            style={{ fontFamily: props.promptFont, fontSize: props.promptFontSize }}
          >
            Ask AI Chat to explain this code and suggest a clearer approach.
          </div>
        </FontSelector>
        <Separator />
        <FontSelector
          id="code-font"
          label="Code font"
          description="Used for code blocks, diffs, and inline code."
          value={props.codeFont}
          size={props.codeFontSize}
          fonts={availableFonts}
          disabled={props.disabled}
          onFontChange={props.onCodeFontChange}
          onSizeChange={props.onCodeFontSizeChange}
        >
          <ConfigStoreProvider initialState={{ wrapline: false, showFullCode: true }}>
            <CodeBlock
              code={CODE_PREVIEW}
              language="typescript"
              isIncomplete={false}
              showCopyAndWrap={false}
            />
          </ConfigStoreProvider>
        </FontSelector>
      </FieldGroup>
    </section>
  );
}

type FontSelectorProps = {
  id: string;
  label: string;
  description: string;
  value: string;
  size: number;
  fonts: string[];
  disabled: boolean;
  children?: ReactNode;
  onFontChange: (font: string) => void;
  onSizeChange: (size: number) => void;
};

function FontSelector(props: FontSelectorProps) {
  return (
    <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
        <FieldDescription>{props.description}</FieldDescription>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
        <FontCombobox
          id={props.id}
          label={props.label}
          value={props.value}
          fonts={props.fonts}
          disabled={props.disabled}
          onValueChange={props.onFontChange}
        />

        <Select
          value={String(props.size)}
          disabled={props.disabled}
          onValueChange={(value) => {
            if (!value) return;
            const nextSize = Number(value);
            if (Number.isInteger(nextSize)) props.onSizeChange(nextSize);
          }}
        >
          <SelectTrigger
            id={`${props.id}-size`}
            className="h-10 w-full text-sm"
            aria-label={`${props.label} size`}
          >
            <SelectValue>{props.size} px</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} px
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {props.children && <div className="min-w-0 md:col-span-2">{props.children}</div>}
    </Field>
  );
}

type FontComboboxProps = {
  id: string;
  label: string;
  value: string;
  fonts: string[];
  disabled: boolean;
  onValueChange: (font: string) => void;
};

function FontCombobox(props: FontComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingFonts = normalizedQuery
    ? props.fonts.filter((font) => font.toLocaleLowerCase().includes(normalizedQuery))
    : props.fonts;
  const visibleFonts = matchingFonts.slice(0, MAX_VISIBLE_FONTS);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        id={props.id}
        disabled={props.disabled}
        aria-label={`${props.label}: ${props.value}`}
        className={cn(
          "flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm transition-colors outline-none",
          "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
        )}
      >
        <span className="truncate" style={{ fontFamily: props.value }}>
          {props.value}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        includeArrow={false}
        className="w-[var(--anchor-width)] min-w-64 gap-0 overflow-hidden p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search fonts…" value={query} onValueChange={setQuery} autoFocus />
          <CommandList className="max-h-72 p-1">
            {visibleFonts.length === 0 ? (
              <CommandEmpty>No fonts found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {visibleFonts.map((font) => (
                  <CommandItem
                    key={font}
                    value={font}
                    data-checked={font === props.value}
                    style={{ fontFamily: font }}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      window.requestAnimationFrame(() => {
                        startTransition(() => props.onValueChange(font));
                      });
                    }}
                  >
                    <span className="truncate">{font}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
