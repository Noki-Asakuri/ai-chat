import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { Message } from "./message";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "../ui/message-scroller";

import {
  getStickyToBottom,
  setStickyToBottom,
  updateStickyToBottomFromScroll,
} from "@/lib/chat/scroll-stickiness";
import { useWindowEvent } from "@/lib/hooks/use-window-event";
import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";
import { cn } from "@/lib/utils";

type MessageHistoryProps = {
  readOnly?: boolean;
  showUserAvatar?: boolean;
  bottomPaddingPx?: number;
  insetBelowHeader?: boolean;
};

export function MessageHistory({
  readOnly = false,
  showUserAvatar = true,
  bottomPaddingPx,
  insetBelowHeader = false,
}: MessageHistoryProps) {
  const textareaHeight = useChatStore((state) => state.textareaHeight);
  const resolvedBottomPadding = bottomPaddingPx ?? textareaHeight;

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={40}>
      <MessageScroller
        className={cn("absolute right-0 bottom-0 left-0", insetBelowHeader ? "top-10" : "top-0")}
      >
        <MessageScrollerEvents />
        <MessageScrollerViewport
          id="messages-scrollarea"
          className="custom-scroll scroll-fade-t overflow-y-scroll"
          style={{ scrollbarGutter: "stable both-edges" }}
          onScroll={(event) => updateStickyToBottomFromScroll(event.currentTarget)}
        >
          <MessageScrollerContent
            data-slot="message-history"
            className={cn(
              "mx-auto min-h-full w-full max-w-[calc(56rem+32px)] gap-4 px-4",
              insetBelowHeader ? "pt-2" : "pt-12",
            )}
            style={{ paddingBottom: `${resolvedBottomPadding}px` }}
          >
            <Messages readOnly={readOnly} showUserAvatar={showUserAvatar} />
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton
          title="Scroll to Bottom"
          className="bg-background/80 text-muted-foreground backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-card"
          style={{ bottom: `${resolvedBottomPadding + 8}px` }}
        />
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

  return messages.map((messageId, index) => (
    <MessageHistoryItem
      key={messageId}
      messageId={messageId}
      index={index}
      total={messages.length}
      readOnly={readOnly}
      showUserAvatar={showUserAvatar}
    />
  ));
}

function MessageHistoryItem({
  messageId,
  index,
  total,
  readOnly,
  showUserAvatar,
}: {
  messageId: Id<"messages">;
  index: number;
  total: number;
  readOnly: boolean;
  showUserAvatar: boolean;
}) {
  const role = useMessageStore((state) => state.messagesById[messageId]?.role);

  return (
    <MessageScrollerItem messageId={messageId} scrollAnchor={role === "user"}>
      <Message
        messageId={messageId}
        index={index}
        total={total}
        readOnly={readOnly}
        showUserAvatar={showUserAvatar}
      />
    </MessageScrollerItem>
  );
}
