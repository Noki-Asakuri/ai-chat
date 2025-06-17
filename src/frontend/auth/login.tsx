import { SignIn } from "@clerk/react-router";
import { dark } from "@clerk/themes";

export function LoginPage() {
  return (
    <div className="grid h-svh w-screen items-center justify-center px-4">
      <SignIn waitlistUrl="/auth/waitlist" withSignUp appearance={{ baseTheme: dark }} />
    </div>
  );
}
