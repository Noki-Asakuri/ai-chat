import { useCopyToClipboard } from "@uidotdev/usehooks";
import { CopyCheckIcon, CopyIcon } from "lucide-react";
import { useTransition } from "react";

import { ButtonWithTip } from "./ui/button";

type CopyButtonProps = React.ComponentProps<typeof ButtonWithTip> & {
  content: string;
};

export function CopyButton({ content, className, ...props }: CopyButtonProps) {
  const [pending, startTransition] = useTransition();
  const [, copyToClipboard] = useCopyToClipboard();

  function copeMessageContent(content: string) {
    startTransition(async () => {
      await copyToClipboard(content.trim());
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
  }

  return (
    <ButtonWithTip
      size="icon"
      variant="ghost"
      className={className}
      onMouseDown={() => copeMessageContent(content)}
      title="Copy Message"
      disabled={pending}
      {...props}
    >
      {pending ? <CopyCheckIcon className="size-5" /> : <CopyIcon className="size-5" />}
    </ButtonWithTip>
  );
}
