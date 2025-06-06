import { useCopyToClipboard } from "@uidotdev/usehooks";
import { CopyCheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { ButtonWithTip } from "../ui/button";

export function CopyButton({ content }: { content: string }) {
  const [pedding, startTransition] = useTransition();
  const [, copyToClipboard] = useCopyToClipboard();

  function copeMessageContent(content: string) {
    startTransition(async () => {
      await copyToClipboard(content.trim());
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
  }

  return (
    <ButtonWithTip
      variant="ghost"
      className="size-8 cursor-pointer p-2"
      onMouseDown={() => copeMessageContent(content)}
      title="Copy Message"
      disabled={pedding}
    >
      {pedding ? <CopyCheckIcon className="size-5" /> : <CopyIcon className="size-5" />}
    </ButtonWithTip>
  );
}
