import { Waitlist } from "@clerk/react-router";
import { dark } from "@clerk/themes";

export function WaitlistPage() {
  return (
    <div className="grid h-svh w-full items-center justify-center px-4">
      <Waitlist afterJoinWaitlistUrl="/auth/login" appearance={{ baseTheme: dark }} />
    </div>
  );
}
