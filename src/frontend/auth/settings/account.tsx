import { UserProfile } from "@clerk/react-router";
import { dark } from "@clerk/themes";

export function AccountPage() {
  return (
    <div className="space-y-8">
      <UserProfile appearance={{ baseTheme: dark }} />
    </div>
  );
}
