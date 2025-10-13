import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { PlusIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Navigate, NavLink, useParams } from "react-router";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { MessageHistory } from "@/components/message/message-history";
import { ThreadCommand } from "@/components/threads/thread-command";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { sendChatRequest } from "@/lib/chat/send-chat-request";
import { chatStore, useChatStore } from "@/lib/chat/store";
import { fromUUID } from "@/lib/utils";

export function Chat() {
  const resumeRef = useRef<boolean>(false);
  const dragCounterRef = useRef<number>(0);
  const { threadId } = useParams<{ threadId: Id<"threads"> }>();

  const isDragOver = useChatStore((s) => s.isDragOver);

  const { data, isLoading, isError, isEnabled } = useQuery({
    enabled: Boolean(threadId),
    ...convexQuery(api.functions.messages.getAllMessagesFromThread, {
      threadId: fromUUID(threadId),
    }),
  });

  useEffect(() => {
    const state = chatStore.getState();
    if (!data?.messages || data.messages.length === 0) return state.resetState();

    const lastMessage = data.messages.at(-1)!;
    const threadIdLocal = lastMessage.threadId;

    console.debug("[Convex] Syncing messages from Convex", { data, threadId: threadIdLocal });
    state.setDataFromConvex(data.messages, lastMessage.status ?? "complete");
    state.setChatConfig({ model: lastMessage.model });

    if (
      lastMessage?.resumableStreamId &&
      lastMessage.status === "streaming" &&
      !state.hasActiveStream(lastMessage._id) &&
      !resumeRef.current
    ) {
      resumeRef.current = true;
      console.debug("[Convex] Resuming chat streaming", {
        threadId: threadIdLocal,
        streamId: lastMessage.resumableStreamId,
      });

      void sendChatRequest(
        `/api/ai/chat?streamId=${lastMessage.resumableStreamId}`,
        undefined,
        lastMessage._id,
      );
      resumeRef.current = false;
    }
  }, [data]);

  function handleAddAttachments(files: Array<File>) {
    const acceptFiles = files.filter(
      (file) => file.type.includes("image") || file.type.includes("pdf"),
    );

    if (acceptFiles.length > 0) {
      const attachments = acceptFiles.map((file) => {
        let type: "image" | "pdf" = "image";
        if (file.type.includes("pdf")) type = "pdf";

        return { id: uuidv4(), name: file.name, size: file.size, file, type, mimeType: file.type };
      });

      useChatStore.getState().addAttachment(attachments);
    }

    if (acceptFiles.length < files.length) {
      toast.error("File type not supported", {
        description: "Please upload an image or PDF file.",
      });
    }
  }

  if (isError && threadId) return <Navigate to="/" replace />;

  return (
    <main
      data-slot="chat"
      className="relative inset-0 h-dvh w-screen overflow-hidden"
      onDragEnter={(event) => {
        const types = event.dataTransfer?.types ?? [];
        const draggingFiles = Array.from(types).includes("Files");

        if (!draggingFiles) return;
        dragCounterRef.current += 1;
        useChatStore.getState().setIsDragOver(true);
      }}
      onDragOver={(event) => {
        const types = event.dataTransfer?.types ?? [];
        const draggingFiles = Array.from(types).includes("Files");

        if (!draggingFiles) return;
        event.preventDefault();
        if (!isDragOver) useChatStore.getState().setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        const types = event.dataTransfer?.types ?? [];
        const draggingFiles = Array.from(types).includes("Files");

        if (!draggingFiles) return;
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) useChatStore.getState().setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const native = event.nativeEvent as DragEvent;
        const path =
          typeof native.composedPath === "function"
            ? native.composedPath()
            : [event.target as EventTarget];

        // Avoid double-handling when dropping directly on the textarea (it has its own onDrop)
        if (path.some((t) => t instanceof Element && t.id === "textarea-chat-input")) {
          dragCounterRef.current = 0;
          useChatStore.getState().setIsDragOver(false);
          return;
        }

        const files = Array.from(event.dataTransfer.files ?? []);
        dragCounterRef.current = 0;
        useChatStore.getState().setIsDragOver(false);
        if (files.length > 0) {
          handleAddAttachments(files);
        }
      }}
    >
      <WelcomeScreen />
      <MessageRenderer thread={data?.thread} isLoading={isLoading && !isEnabled} />
      <ChatTextarea />

      {/* Global drop overlay for the chat section (excludes the sidebar) */}
      <div
        aria-hidden="true"
        data-active={isDragOver}
        className="group pointer-events-none absolute inset-0 z-5 flex items-center justify-center"
      >
        <div className="m-2 flex h-[calc(100%-1rem)] w-[calc(100%-1rem)] items-center justify-center rounded-md border-2 border-primary border-dashed bg-primary/10 text-primary opacity-0 transition-opacity duration-150 group-data-[active=true]:opacity-100">
          <span className="rounded-md border bg-background/80 px-3 py-1 text-sm">
            Drop files to attach
          </span>
        </div>
      </div>
    </main>
  );
}

type MessageRendererProps = {
  thread?: Doc<"threads"> | null;
  isLoading: boolean;
};

function MessageRenderer({ thread, isLoading }: MessageRendererProps) {
  const { state } = useSidebar();

  return (
    <>
      <div
        data-sidebar-state={state}
        className="absolute top-0 z-10 flex h-10 w-full items-center justify-between gap-2 border-x border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
      >
        <div className="flex items-center gap-2">
          <SidebarTrigger />

          <NavLink
            to="/"
            className="rounded-md p-1.5 text-center transition-colors hover:bg-primary/20"
          >
            <PlusIcon className="size-4" />
            <span className="sr-only">Create new thread</span>
          </NavLink>

          <ThreadTitle thread={thread} isLoading={isLoading} />
        </div>

        <div>
          <ThreadCommand />
        </div>
      </div>

      <MessageHistory />
    </>
  );
}

type ThreadTitleProps = {
  thread?: Doc<"threads"> | null;
  isLoading: boolean;
};

function ThreadTitle({ thread, isLoading }: ThreadTitleProps) {
  if (isLoading) return <Skeleton className="h-4 w-80" />;
  if (!thread) return <p className="text-muted-foreground text-sm">New Thread</p>;
  return <p className="truncate text-muted-foreground text-sm">{thread.title}</p>;
}
