import { useCopyToClipboard } from "@uidotdev/usehooks";
import { CopyCheckIcon, CopyIcon } from "lucide-react";
import { useTransition } from "react";

import { ButtonWithTip } from "../ui/button";

export function CopyButton({ content, className }: { content: string; className?: string }) {
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
      className={className}
      onMouseDown={() => copeMessageContent(content)}
      title="Copy Message"
      disabled={pedding}
    >
      {pedding ? <CopyCheckIcon className="size-5" /> : <CopyIcon className="size-5" />}
    </ButtonWithTip>
  );
}
