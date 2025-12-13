import { useConfigStore } from "@/components/provider/config-provider";

export function useGetSendDescription(): string {
  const sendPreference = useConfigStore((state) => state.pref);

  if (sendPreference === "ctrlEnter") {
    return "Press Ctrl or Command plus Enter to send. Press Enter for a new line.";
  }

  return "Press Enter to send. Press Shift + Enter for a new line.";
}

export type KeyInfo = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export function useShouldSend() {
  const pref = useConfigStore((state) => state.pref);

  return function (keyInfo: KeyInfo) {
    if (keyInfo.key !== "Enter") return false;

    if (pref === "ctrlEnter") {
      return keyInfo.ctrlKey || keyInfo.metaKey;
    }

    return !keyInfo.shiftKey || keyInfo.ctrlKey || keyInfo.metaKey;
  };
}
