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

type MessageHistoryProps = {
  readOnly?: boolean;
  showUserAvatar?: boolean;
  bottomPaddingPx?: number;
  topPaddingPx?: number;
};

export function MessageHistory({
  readOnly = false,
  showUserAvatar = true,
  bottomPaddingPx,
  topPaddingPx = 48,
}: MessageHistoryProps) {
  const textareaHeight = useChatStore((state) => state.textareaHeight);
  const resolvedBottomPadding = bottomPaddingPx ?? textareaHeight;

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={40}>
      <MessageScroller className="absolute right-0 bottom-0 left-0">
        <MessageScrollerEvents />
        <MessageScrollerViewport
          id="messages-scrollarea"
          className="custom-scroll overflow-y-scroll"
          style={{ scrollbarGutter: "stable both-edges" }}
          onScroll={(event) => updateStickyToBottomFromScroll(event.currentTarget)}
        >
          <MessageScrollerContent
            data-slot="message-history"
            className="mx-auto min-h-full w-full max-w-[calc(56rem+32px)] gap-4 px-4"
            style={{ paddingTop: `${topPaddingPx}px`, paddingBottom: `${resolvedBottomPadding}px` }}
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

type MessageHistoryItemProps = {
  messageId: Id<"messages">;
  index: number;
  total: number;
  readOnly: boolean;
  showUserAvatar: boolean;
};

function MessageHistoryItem(props: MessageHistoryItemProps) {
  const role = useMessageStore((state) => state.messagesById[props.messageId]?.role);

  return (
    <MessageScrollerItem messageId={props.messageId} scrollAnchor={role === "user"}>
      <Message {...props} />
    </MessageScrollerItem>
  );
}
