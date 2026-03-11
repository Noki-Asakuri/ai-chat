import type { LinkSafetyModalProps } from "streamdown";

import { CopyIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

const FADE_DURATION_MS = 300;

export function ExternalLinkSafetyModal({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) {
  const [isPresent, setIsPresent] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const openAnimationFrameIdRef = useRef<number | null>(null);
  const closeTimeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (openAnimationFrameIdRef.current !== null) {
      cancelAnimationFrame(openAnimationFrameIdRef.current);
      openAnimationFrameIdRef.current = null;
    }

    if (closeTimeoutIdRef.current !== null) {
      window.clearTimeout(closeTimeoutIdRef.current);
      closeTimeoutIdRef.current = null;
    }

    if (isOpen) {
      setIsPresent(true);
      setIsVisible(false);

      openAnimationFrameIdRef.current = requestAnimationFrame(() => {
        openAnimationFrameIdRef.current = requestAnimationFrame(() => {
          setIsVisible(true);
          openAnimationFrameIdRef.current = null;
        });
      });

      return () => {
        if (openAnimationFrameIdRef.current !== null) {
          cancelAnimationFrame(openAnimationFrameIdRef.current);
          openAnimationFrameIdRef.current = null;
        }
      };
    }

    setIsVisible(false);
    closeTimeoutIdRef.current = window.setTimeout(() => {
      setIsPresent(false);
      closeTimeoutIdRef.current = null;
    }, FADE_DURATION_MS);

    return () => {
      if (closeTimeoutIdRef.current !== null) {
        window.clearTimeout(closeTimeoutIdRef.current);
        closeTimeoutIdRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  }

  if (!isPresent || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-streamdown="link-safety-modal"
      className={cn(
        "fixed inset-0 z-[70] flex items-center justify-center bg-background/50 p-4 backdrop-blur-sm transition-opacity duration-300 ease-out",
        isVisible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Open external link"
        aria-modal="true"
        className={cn(
          "relative flex w-full max-w-md flex-col gap-4 rounded-xl border bg-background p-6 shadow-lg transition-opacity duration-300 ease-out",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          title="Close"
          onClick={onClose}
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>

        <div className="flex flex-col gap-2 pr-8">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <ExternalLinkIcon className="size-5" />
            <span>Open external link?</span>
          </div>
          <p className="text-sm text-muted-foreground">
            You&apos;re about to visit an external website.
          </p>
        </div>

        <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">{url}</div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
            <CopyIcon className="size-4" />
            <span>Copy link</span>
          </Button>
          <Button className="flex-1" onClick={onConfirm}>
            <ExternalLinkIcon className="size-4" />
            <span>Open link</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
