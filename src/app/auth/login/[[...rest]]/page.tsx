import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignInPage() {
  return (
    <div className="grid h-svh w-full items-center px-4 sm:justify-center">
      <SignIn waitlistUrl="/auth/waitlist" withSignUp appearance={{ baseTheme: dark }} />
    </div>
  );
}
