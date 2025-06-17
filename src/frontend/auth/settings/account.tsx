import { UserProfile } from "@clerk/react-router";
import { dark } from "@clerk/themes";

export function AccountPage() {
  return <UserProfile appearance={{ baseTheme: dark }} />;
}
