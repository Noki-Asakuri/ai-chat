import { useLoaderData } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../avatar";

import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      className,
    )}
    {...props}
  />
);

const messageContentVariants = cva(
  "is-user:dark flex flex-col gap-2 rounded-md border p-2",
  {
    variants: {
      variant: {
        contained: [
          "max-w-full px-4 py-3",
          "group-[.is-user]:bg-muted/80 group-[.is-user]:text-foreground",
          "group-[.is-assistant]:bg-background/80 group-[.is-assistant]:text-foreground",
        ],
        flat: [
          "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
          "group-[.is-assistant]:text-foreground",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  },
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export const MessageContent = ({ children, className, variant, ...props }: MessageContentProps) => (
  <div className={cn(messageContentVariants({ variant, className }))} {...props}>
    {children}
  </div>
);

export const MessageAvatar = ({ className, ...props }: ComponentProps<typeof Avatar>) => {
  const { user } = useLoaderData({ from: "/_chat_layout" });

  return (
    <Avatar className={cn("size-11 rounded-md ring-1 ring-border", className)} {...props}>
      <AvatarImage alt="" className="mt-0 mb-0" src={user.profilePictureUrl as string} />
      <AvatarFallback>{user?.firstName?.slice(0, 2) || "You"}</AvatarFallback>
    </Avatar>
  );
};
