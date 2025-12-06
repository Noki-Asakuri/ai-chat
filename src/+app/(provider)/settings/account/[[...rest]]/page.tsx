import "@/styles/clerk-user-profile.css";

import { UserProfile } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Account</h2>
        <p className="text-muted-foreground">Manage your account settings.</p>
      </div>

      <UserProfile appearance={{ baseTheme: dark }} />
    </div>
  );
}
