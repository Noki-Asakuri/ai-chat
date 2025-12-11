// import { useLocalStorage } from "@uidotdev/usehooks";
import { tryCatchSync } from "../utils";

export type SendPreference = { pref: "enter" | "ctrlEnter" };

export const STORAGE_KEY = "sendPreference";

export function getSendPreference(): SendPreference {
  if (typeof window === "undefined" || !window.localStorage) return { pref: "enter" };

  const [sendPreference, error] = tryCatchSync(
    () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as SendPreference,
  );

  if (error || !sendPreference.pref || !["enter", "ctrlEnter"].includes(sendPreference.pref)) {
    return { pref: "enter" };
  }

  return sendPreference;
}

export function useGetSendDescription(): string {
  // const [sendPreference] = useLocalStorage<SendPreference>(STORAGE_KEY, {
  //   pref: "enter",
  // });

  // if (sendPreference.pref === "ctrlEnter") {
  //   return "Press Ctrl or Command plus Enter to send. Press Enter for a new line.";
  // }

  return "Press Enter to send. Press Shift + Enter for a new line.";
}

export type KeyInfo = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export function shouldSend(keyInfo: KeyInfo): boolean {
  const { pref } = getSendPreference();
  if (keyInfo.key !== "Enter") return false;

  if (pref === "ctrlEnter") {
    return keyInfo.ctrlKey || keyInfo.metaKey;
  }

  // pref === "enter"
  return !keyInfo.shiftKey || keyInfo.ctrlKey || keyInfo.metaKey;
}
