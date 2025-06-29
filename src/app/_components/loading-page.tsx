import { Loader2Icon } from "lucide-react";

export function LoadingPage({ text }: { text?: string }) {
  return (
    <main className="flex h-svh w-screen items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <img src="/favicon.svg" alt="AI Chat" className="size-20" />

        <div className="flex items-center gap-2">
          <span>{text ?? "Loading..."}</span>
          <Loader2Icon className="animate-spin" />
        </div>
      </div>
    </main>
  );
}
