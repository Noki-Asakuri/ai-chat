import "@/styles/clerk-user-profile.css";

import type { Metadata } from "next";

import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export const metadata: Metadata = {
  title: "Login - AI Chat",
};

export default function LoginPage() {
  return (
    <div className="grid h-svh w-screen items-center justify-center px-4">
      <SignIn withSignUp appearance={{ baseTheme: dark }} />
    </div>
  );
}
