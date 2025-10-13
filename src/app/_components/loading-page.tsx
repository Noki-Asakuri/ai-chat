import { Loader2Icon } from "lucide-react";
import Image from "next/image";

export function LoadingPage() {
  return (
    <main className="flex h-svh w-screen items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <Image width={80} height={80} src="/favicon.svg" alt="AI Chat" className="size-20" />

        <div className="flex items-center gap-2">
          <span>Loading...</span>
          <Loader2Icon className="animate-spin" />
        </div>
      </div>
    </main>
  );
}
