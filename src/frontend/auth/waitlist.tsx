import { Waitlist } from "@clerk/react-router";
import { dark } from "@clerk/themes";
import { useDocumentTitle } from "@uidotdev/usehooks";

export function WaitlistPage() {
  useDocumentTitle("Waitlist - AI Chat");

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
