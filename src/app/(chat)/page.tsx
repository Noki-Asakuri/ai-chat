"use client";

import dynamic from "next/dynamic";
const ChatInterface = dynamic(() => import("./chat-interface").then((d) => d.ChatInterface), { ssr: false });

export default function Page() {
  return <ChatInterface />;
}
