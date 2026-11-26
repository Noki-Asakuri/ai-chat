import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
} from "react";
import { toast } from "@/components/ui/toast";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

import { ChatActionButtons } from "./action-buttons";
import { ChatAttachmentsDisplay } from "./attachments-display";
import {
  animateComposerFrom,
  measureComposer,
  prefersReducedMotion,
  type ComposerSnapshot,
} from "./composer-flip";
import { MobileChatToolsMenu } from "./mobile-chat-tools-menu";
import { RichComposer } from "./rich-composer";
import { ChatSendButton } from "./send-button";

import { getAttachmentRejectionMessage, prepareAttachmentsForModel } from "@/lib/chat/attachments";
import { isPastFileReadableBy, MAIN_COMPOSER_ID } from "@/lib/chat/composer-tokens";
import { useSendChatMessage } from "@/lib/chat/server-function/send-chat-message";
import { useConfigStore } from "../provider/config-provider";
import { chatStoreActions, useChatStore } from "@/lib/store/chat-store";
import { getConvexReactClient } from "@/lib/convex/client";
import { convexQuery } from "@convex-dev/react-query";
import { fromUUID, tryCatch } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ChatTextarea() {
  const parentRef = useRef<HTMLFormElement>(null);
  const { ref: composerRef, expanded, onFocusCapture, onBlurCapture } = useComposerExpanded();
  const onResize = useEffectEvent((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;

    // Minus the border width (1px) on both sides
    chatStoreActions.setTextareaHeight(entry.target.clientHeight - 2);
  });

  useEffect(() => {
    if (!parentRef.current) return undefined;

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(parentRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div data-slot="chat-textarea" className="pointer-events-none absolute bottom-2 w-full px-2 sm:px-4">
      <form ref={parentRef} className="mx-auto space-y-2">
        <SettledThreadNotice />

        <div className="surface-edge pointer-events-auto relative mx-auto max-w-4xl space-y-2 overflow-hidden rounded-xl border border-border/80 bg-background/80 shadow-lg backdrop-blur-md backdrop-saturate-150 transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-primary/45 focus-within:bg-background/85 focus-within:ring-2 focus-within:ring-primary/15 motion-reduce:transition-none">
          <ChatAttachmentsDisplay />

          {/*
           * On phones the composer has two states. Collapsed (empty, not focused) it is one row:
           * tools, a one-line input and send. Expanded, the input takes the full width and the
           * tools, model picker and send move to a row below. Only the flex order changes, so the
           * input is never remounted and keeps focus. Wider screens always use the expanded layout.
           */}
          <div
            ref={composerRef}
            data-slot="chat-composer"
            data-expanded={expanded}
            className="group/composer flex flex-wrap content-start items-end gap-x-2 gap-y-1 px-2 pb-2 data-[expanded=false]:max-sm:items-center data-[expanded=false]:max-sm:pt-2 sm:px-2.5 sm:pb-3"
            onFocusCapture={onFocusCapture}
            onBlurCapture={onBlurCapture}
          >
            <div className="order-1 min-w-0 basis-full group-data-[expanded=false]/composer:max-sm:order-2 group-data-[expanded=false]/composer:max-sm:flex-1 group-data-[expanded=false]/composer:max-sm:basis-0">
              <InputChatTextArea />
            </div>

            <MobileChatToolsMenu className="order-2 group-data-[expanded=false]/composer:max-sm:order-1" />

            <div className="order-3 flex min-w-0 flex-1 group-data-[expanded=false]/composer:max-sm:hidden">
              <ChatActionButtons />
            </div>

            <div className="order-4 group-data-[expanded=false]/composer:max-sm:order-3">
              <ChatSendButton />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

const EDITOR_SELECTOR = "[data-composer]";
const OPEN_POPUP_SELECTOR = '[aria-expanded="true"], [data-popup-open]';

/**
 * Tracks whether the phone composer is expanded. It expands when the input gets focus or holds
 * text or attachments, and collapses once focus leaves the composer while it is empty. Focus on
 * the tools button alone does not expand it, so its menu opens from the collapsed row.
 *
 * The layout is measured right before each switch and animated from there after React renders
 * the new one. On wider screens the layout does not change, so nothing animates.
 */
function useComposerExpanded() {
  const ref = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  // Only the first value matters; later changes go through update() so the layout is measured first.
  const initialExpanded = useChatStore(hasComposerContent);
  const expandedRef = useRef(initialExpanded);
  const snapshotRef = useRef<ComposerSnapshot | null>(null);
  const [expanded, setExpanded] = useState(initialExpanded);

  function update() {
    const next = isFocusedRef.current || hasComposerContent(useChatStore.getState());
    if (next === expandedRef.current) return;

    if (ref.current && !prefersReducedMotion()) {
      snapshotRef.current = measureComposer(ref.current);
    }

    expandedRef.current = next;
    setExpanded(next);
  }

  const onStoreChange = useEffectEvent(update);
  useEffect(() => useChatStore.subscribe(() => onStoreChange()), []);

  // Runs after every render, but only animates when update() left a snapshot for this switch.
  useLayoutEffect(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot || !ref.current) return;

    snapshotRef.current = null;
    animateComposerFrom(ref.current, snapshot);
  });

  function onFocusCapture(event: FocusEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest(EDITOR_SELECTOR)) {
      isFocusedRef.current = true;
      update();
    }
  }

  function onBlurCapture(event: FocusEvent<HTMLDivElement>) {
    const container = ref.current;
    const next = event.relatedTarget;
    if (!container || (next instanceof Node && container.contains(next))) return;

    // Focus moves to menus rendered in a portal; wait a frame and keep the layout while one is open,
    // so the model picker does not jump away from its anchor.
    requestAnimationFrame(() => {
      if (container.contains(document.activeElement)) return;
      if (container.querySelector(OPEN_POPUP_SELECTOR)) return;
      isFocusedRef.current = false;
      update();
    });
  }

  return { ref, expanded, onFocusCapture, onBlurCapture };
}

function hasComposerContent(state: { input: string; attachments: readonly unknown[] }): boolean {
  return state.input.trim().length > 0 || state.attachments.length > 0;
}

function SettledThreadNotice() {
  const [isUnsettling, startUnsettling] = useTransition();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data } = useQuery({
    enabled: threadId !== undefined,
    ...convexQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  });

  if (!threadId || data?.settled !== true) return null;

  function handleUnsettle(): void {
    startUnsettling(async () => {
      if (!threadId) return;

      const [, error] = await tryCatch(
        convexClient.mutation(api.functions.threads.unsettleThread, { threadId }),
      );
      if (!error) return;

      console.error("[Thread] Unsettle thread error:", error);
      toast.error("Failed to unsettle thread", { description: error.message });
    });
  }

  return (
    <Alert className="pointer-events-auto mx-auto max-w-4xl border-primary/50 bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <CircleCheckIcon className="text-primary" aria-hidden="true" />
      <AlertTitle>This thread is settled</AlertTitle>
      <AlertDescription>Sending a message moves it back to Active in the sidebar.</AlertDescription>
      <AlertAction className="top-1/2 -translate-y-1/2">
        <Button type="button" variant="outline" size="sm" disabled={isUnsettling} onClick={handleUnsettle}>
          {isUnsettling ? "Un-settling" : "Un-settle"}
        </Button>
      </AlertAction>
    </Alert>
  );
}

function InputChatTextArea() {
  const input = useChatStore((state) => state.input);
  const uploads = useChatStore((state) => state.attachments);
  const model = useConfigStore((state) => state.model);
  const { sendChatRequest } = useSendChatMessage();

  function handleAddAttachments({ files }: { files: File[] }) {
    const { attachments, rejectedCount } = prepareAttachmentsForModel(files, model);

    if (attachments.length > 0) {
      chatStoreActions.addAttachments(attachments);
    }

    if (rejectedCount > 0) {
      toast.error("File type not supported", {
        description: getAttachmentRejectionMessage(model),
      });
    }
  }

  return (
    <RichComposer
      id={MAIN_COMPOSER_ID}
      input={input}
      setInput={chatStoreActions.setInput}
      model={model}
      uploads={uploads}
      onRemoveChips={chatStoreActions.removeChipAttachments}
      // A past file the model can't read isn't sent, so its chip shows as just its name.
      isFileAttached={(attachmentId) => isPastFileReadableBy(model, attachmentId)}
      handleAddAttachments={handleAddAttachments}
      onConfirm={sendChatRequest}
      enableCommands
      compact
    />
  );
}
