import { useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";

import { Message } from "./message";

import { Button } from "@/components/ui/button";

import {
  scrollToBottomIfStickyRaf,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import type { MessageUserIdentity } from "@/lib/types";
import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

export function MessageHistory({
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
  readOnly = false,
  userIdentity,
  bottomPaddingPx,
}: {
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<void> | void;
  readOnly?: boolean;
  userIdentity?: MessageUserIdentity;
  bottomPaddingPx?: number;
}) {
  const textareaHeight = useChatStore((state) => state.textareaHeight);
  const resolvedBottomPadding = bottomPaddingPx ?? textareaHeight;
  const resolvedUserIdentity = userIdentity ?? {
    displayName: "User",
    avatarUrl: undefined,
  };

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const stickySyncRafRef = useRef<number | null>(null);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const content = contentRef.current;
    if (!scrollArea || !content) return;

    const scrollElement: HTMLElement = scrollArea;

    // Initialize sticky state based on the current scroll position (after initial render).
    updateStickyToBottomFromScroll(scrollElement);

    function syncStickyFromScroll(): void {
      updateStickyToBottomFromScroll(scrollElement);
    }

    function handleScroll(): void {
      if (scrollRafRef.current !== null) return;

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        syncStickyFromScroll();
      });
    }

    const passiveScrollOptions: AddEventListenerOptions = { passive: true };
    scrollElement.addEventListener("scroll", handleScroll, passiveScrollOptions);

    const resizeObserver = new ResizeObserver(() => {
      if (stickySyncRafRef.current !== null) return;

      stickySyncRafRef.current = requestAnimationFrame(() => {
        stickySyncRafRef.current = null;
        scrollToBottomIfStickyRaf(scrollElement, "auto");
      });
    });

    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();

      scrollElement.removeEventListener("scroll", handleScroll, passiveScrollOptions);

      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }

      if (stickySyncRafRef.current !== null) {
        cancelAnimationFrame(stickySyncRafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollAreaRef}
      id="messages-scrollarea"
      className="custom-scroll absolute inset-0 overflow-y-scroll"
      style={{ scrollbarGutter: "stable both-edges" }}
    >
      <div
        ref={contentRef}
        data-slot="message-history"
        className="mx-auto min-h-full max-w-6xl space-y-10 px-3 pt-20 md:px-6"
        style={{ paddingBottom: `${resolvedBottomPadding}px` }}
      >
        {hasOlderMessages && (
          <div className="flex w-full justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onLoadOlderMessages?.()}
              disabled={isLoadingOlderMessages}
            >
              {isLoadingOlderMessages ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading older messages
                </>
              ) : (
                "Load older messages"
              )}
            </Button>
          </div>
        )}

        <Messages readOnly={readOnly} userIdentity={resolvedUserIdentity} />
      </div>
    </div>
  );
}

function Messages({
  readOnly = false,
  userIdentity,
}: {
  readOnly?: boolean;
  userIdentity: MessageUserIdentity;
}) {
  const messages = useMessageStore((state) => state.messageIds);

  return messages.map((messageId, index) => (
    <Message
      key={messageId}
      messageId={messageId}
      index={index}
      total={messages.length}
      readOnly={readOnly}
      userIdentity={userIdentity}
    />
  ));
}
