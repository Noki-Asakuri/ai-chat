import "@/styles/clerk-user-profile.css";

import type { Metadata } from "next";

import { Waitlist } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export const metadata: Metadata = {
  title: "Waitlist - AI Chat",
};

export default function WaitlistPage() {
  return (
    <div className="grid h-svh w-full items-center justify-center px-4">
      <Waitlist
        signInUrl="/auth/login"
        afterJoinWaitlistUrl="/auth/login"
        appearance={{ baseTheme: dark }}
      />
    </div>
  );
}
