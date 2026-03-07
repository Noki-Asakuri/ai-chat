import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full items-start gap-3 rounded-md p-3 transition-colors duration-150 group-data-[disable-blur=true]/sidebar-provider:backdrop-blur-none group-data-[has-background=true]/sidebar-provider:backdrop-blur-md group-data-[has-background=true]/sidebar-provider:backdrop-saturate-150",
        from === "user"
          ? "is-user group-data-[has-background=true]/sidebar-provider:bg-card/70 hover:bg-card/80"
          : "is-assistant group-data-[has-background=true]/sidebar-provider:bg-background/70 hover:bg-background/80",
        className,
      )}
      {...props}
    />
  );
}

const messageContentVariants = cva("min-w-0 flex flex-col gap-2 text-[0.95rem] leading-7", {
  variants: {
    variant: {
      contained: [
        "rounded-2xl border border-border/50 bg-[linear-gradient(180deg,hsl(var(--card)/0.92),hsl(var(--card)/0.74))] px-4 py-3 shadow-sm",
        "backdrop-blur-md backdrop-saturate-150",
        "group-[.is-user]:border-border/60 group-[.is-user]:bg-[linear-gradient(180deg,hsl(var(--card)/0.96),hsl(var(--card)/0.82))]",
        "group-[.is-assistant]:bg-transparent group-[.is-assistant]:shadow-none group-[.is-assistant]:border-transparent group-[.is-assistant]:px-0 group-[.is-assistant]:py-0 group-[.is-assistant]:backdrop-blur-none",
      ],
      flat: ["rounded-xl px-0 py-0 text-foreground"],
    },
  },
  defaultVariants: {
    variant: "contained",
  },
});

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export function MessageContent({ children, className, variant, ...props }: MessageContentProps) {
  return (
    <div className={cn(messageContentVariants({ variant, className }))} {...props}>
      {children}
    </div>
  );
}
