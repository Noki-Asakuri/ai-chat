import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { Skeleton } from "@/components/ui/skeleton";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

export function Chat() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  const { data, isLoading } = useQuery({
    enabled: Boolean(params?.threadId),
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, {
      threadId: fromUUID<Id<"threads">>(params?.threadId),
    }),
  });

  return (
    <main data-slot="chat" className="relative inset-0 h-dvh w-screen overflow-hidden">
      {/* <WelcomeScreen /> */}
      {/* <MessageRenderer thread={data?.thread} isLoading={isLoading} /> */}
      <ChatTextarea />
    </main>
  );
}

type MessageRendererProps = {
  thread?: Doc<"threads"> | null;
  isLoading: boolean;
};

// function MessageRenderer({ thread, isLoading }: MessageRendererProps) {
//   const { state } = useSidebar();

//   return (
//     <>
//       <div
//         data-sidebar-state={state}
//         className="absolute top-0 z-10 flex h-10 w-full items-center justify-between gap-2 border-x border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
//       >
//         <div className="flex items-center gap-2">
//           <SidebarTrigger />

//           <Link
//             to="/"
//             className="rounded-md p-1.5 text-center transition-colors hover:bg-primary/20"
//           >
//             <PlusIcon className="size-4" />
//             <span className="sr-only">Create new thread</span>
//           </Link>

//           <ThreadTitle thread={thread} isLoading={isLoading} />
//         </div>

//         <div>
//           <ThreadCommand />
//         </div>
//       </div>

//       <ThreadProfileSidebar />
//       <MessageHistory />
//     </>
//   );
// }

type ThreadTitleProps = {
  thread?: Doc<"threads"> | null;
  isLoading: boolean;
};

function ThreadTitle({ thread, isLoading }: ThreadTitleProps) {
  if (isLoading) return <Skeleton className="h-4 w-80" />;
  if (!thread) return <p className="text-sm text-muted-foreground">New Thread</p>;
  return <p className="truncate text-sm text-muted-foreground">{thread.title}</p>;
}
