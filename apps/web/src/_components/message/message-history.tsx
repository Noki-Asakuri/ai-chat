import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { useState } from "react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "../ui/message-scroller";
import { Button } from "../ui/button";
import { Message } from "./message";

import {
  getStickyToBottom,
  setStickyToBottom,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

const AnimatedMessageScrollerItem = m.create(MessageScrollerItem);

type MessageHistoryProps = {
  readOnly?: boolean;
  showUserAvatar?: boolean;
  bottomPaddingPx?: number;
  topPaddingPx?: number;
  canLoadOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
};

export function MessageHistory({
  readOnly = false,
  showUserAvatar = true,
  bottomPaddingPx,
  topPaddingPx = 48,
  canLoadOlder = false,
  isLoadingOlder = false,
  onLoadOlder,
}: MessageHistoryProps) {
  const textareaHeight = useChatStore((state) => state.textareaHeight);
  const resolvedBottomPadding = bottomPaddingPx ?? textareaHeight;

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={40}>
      <MessageScroller className="absolute right-0 bottom-0 left-0">
        <MessageScrollerEvents />
        <MessageScrollerViewport
          id="messages-scrollarea"
          className="overflow-y-scroll"
          style={{ scrollbarGutter: "stable both-edges" }}
          onScroll={(event) => updateStickyToBottomFromScroll(event.currentTarget)}
        >
          <MessageScrollerContent
            data-slot="message-history"
            className="mx-auto min-h-full w-full max-w-[calc(56rem+32px)] gap-4 px-4"
            style={{ paddingTop: `${topPaddingPx}px`, paddingBottom: `${resolvedBottomPadding}px` }}
          >
            {canLoadOlder && onLoadOlder && (
              <Button
                variant="ghost"
                size="sm"
                className="mx-auto text-muted-foreground"
                disabled={isLoadingOlder}
                onClick={onLoadOlder}
              >
                {isLoadingOlder && <Loader2Icon className="animate-spin" />}
                {isLoadingOlder ? "Loading earlier messages..." : "Load earlier messages"}
              </Button>
            )}
            <Messages readOnly={readOnly} showUserAvatar={showUserAvatar} />
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton
          title="Scroll to end"
          variant="outline"
          size="default"
          className="rounded-full bg-background/90 px-3 font-mono font-normal text-muted-foreground backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-card hover:bg-muted motion-reduce:transition-none"
          style={{ bottom: `${resolvedBottomPadding + 8}px` }}
        >
          <ChevronDownIcon data-icon="inline-start" />
          Scroll to end
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

function MessageScrollerEvents() {
  const { scrollToEnd } = useMessageScroller();

  useWindowEvent("chat:scroll-if-sticky", function handleScrollIfSticky() {
    if (getStickyToBottom()) {
      scrollToEnd({ behavior: "auto" });
    }
  });

  useWindowEvent("chat:force-scroll-bottom", function handleForceScrollBottom() {
    setStickyToBottom(true);
    scrollToEnd({ behavior: "auto" });
  });

  return null;
}

function Messages({
  readOnly = false,
  showUserAvatar = true,
}: {
  readOnly?: boolean;
  showUserAvatar?: boolean;
}) {
  const messages = useMessageStore((state) => state.messageIds);
  const [entrance, setEntrance] = useState({ messages, firstNewIndex: messages.length });

  if (messages !== entrance.messages) {
    const previousLastId = entrance.messages.at(-1);
    const previousLastIndex = previousLastId ? messages.indexOf(previousLastId) : -1;
    setEntrance({
      messages,
      firstNewIndex:
        entrance.messages.length === 0 ? 0 : previousLastIndex < 0 ? messages.length : previousLastIndex + 1,
    });
  }

  return (
    <LazyMotion features={domAnimation}>
      {messages.map((messageId, index) => (
        <MessageHistoryItem
          key={messageId}
          messageId={messageId}
          index={index}
          total={messages.length}
          readOnly={readOnly}
          showUserAvatar={showUserAvatar}
          animateEntrance={index >= entrance.firstNewIndex}
        />
      ))}
    </LazyMotion>
  );
}

type MessageHistoryItemProps = {
  messageId: Id<"messages">;
  index: number;
  total: number;
  readOnly: boolean;
  showUserAvatar: boolean;
  animateEntrance: boolean;
};

function MessageHistoryItem({ animateEntrance, ...props }: MessageHistoryItemProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatedMessageScrollerItem
      messageId={props.messageId}
      initial={
        prefersReducedMotion || !animateEntrance
          ? false
          : { height: 0, marginTop: "-1rem", opacity: 0, y: 8, overflow: "hidden" }
      }
      animate={{
        height: "auto",
        marginTop: 0,
        opacity: 1,
        y: 0,
        transitionEnd: { overflow: "visible" },
      }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Message {...props} />
    </AnimatedMessageScrollerItem>
  );
}
