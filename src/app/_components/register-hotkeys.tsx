import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useChatStore } from "@/lib/chat/store";

const THREAD_COMMAND_KEYBOARD_SHORTCUT = "k";
const NEW_THREAD_KEYBOARD_SHORTCUT = "o";

export function RegisterHotkeys() {
  const router = useRouter();
  const setThreadCommandOpen = useChatStore((state) => state.setThreadCommandOpen);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === THREAD_COMMAND_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setThreadCommandOpen((open) => !open);
      }

      if (
        event.key.toLowerCase() === NEW_THREAD_KEYBOARD_SHORTCUT &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  return null;
}
