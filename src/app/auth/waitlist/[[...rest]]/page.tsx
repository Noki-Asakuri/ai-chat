import { Waitlist } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function WaitlistPage() {
  return (
    <div className="grid h-svh w-full items-center px-4 sm:justify-center">
      <Waitlist afterJoinWaitlistUrl="/auth/login" appearance={{ baseTheme: dark }} />
    </div>
  );
}
