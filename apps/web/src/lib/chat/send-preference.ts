import { useConfigStore } from "@/components/provider/config-provider";

export type SendPreference = "enter" | "ctrlEnter";

export function useGetSendDescription(): string {
  const sendPreference = useConfigStore((state) => state.pref);

  if (sendPreference === "ctrlEnter") {
    return "Press Ctrl or Command plus Enter to send. Press Enter for a new line.";
  }

  return "Press Enter to send. Press Shift + Enter for a new line.";
}
