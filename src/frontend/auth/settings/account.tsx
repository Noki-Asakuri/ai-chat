import { UserProfile } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";

export function AccountPage() {
  return (
    <div className="space-y-8">
      <UserProfile appearance={{ baseTheme: dark }} />
    </div>
  );
}
