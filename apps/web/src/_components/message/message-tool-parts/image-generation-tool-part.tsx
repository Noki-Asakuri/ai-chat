import { CheckIcon, DownloadIcon, ImageIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { z } from "zod/v4";
import { useEffect, useState } from "react";

import { ImageLightboxProvider, ImageLightboxTrigger } from "../../image-lightbox";
import { downloadImage } from "../../image-lightbox/actions";

import type { ToolPart } from "./shared";

import { cn } from "@/lib/utils";

const imageOutputSchema = z.union([z.object({ result: z.string().min(1) }), z.object({ url: z.url() })]);

export function ImageGenerationToolPart({ part, isStreaming }: { part: ToolPart; isStreaming: boolean }) {
  const output = part.state === "output-available" ? imageOutputSchema.safeParse(part.output) : null;
  const nextImageSrc = output?.success
    ? "url" in output.data
      ? output.data.url
      : `data:image/webp;base64,${output.data.result}`
    : null;
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (nextImageSrc && nextImageSrc !== imageSrc) {
      const image = new Image();
      image.src = nextImageSrc;
      void image
        .decode()
        .then(() => {
          if (!cancelled) setImageSrc(nextImageSrc);
          return undefined;
        })
        .catch(() => {
          if (!cancelled) setFailedImageSrc(nextImageSrc);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [nextImageSrc, imageSrc]);
  // The installed SDK drops provider preview flags, so wait for the response stream to end.
  const hasFinalOutput = part.state === "output-available" && !part.preliminary && !isStreaming;
  const isComplete = hasFinalOutput && nextImageSrc !== null && imageSrc === nextImageSrc;
  const hasLoadError = nextImageSrc !== null && failedImageSrc === nextImageSrc;
  const isDenied =
    part.state === "output-denied" || (part.state === "approval-responded" && !part.approval.approved);
  const isFailed = part.state === "output-error";
  const needsApproval = part.state === "approval-requested";
  const isRunning = isStreaming && !isComplete && !isDenied && !isFailed && !needsApproval;

  let status = "Generation stopped";
  let description = "Send a new message to try again.";
  if (isRunning) {
    status = imageSrc ? "Refining image" : "Generating image";
    description = imageSrc
      ? "This is a preview. The finished image will appear here."
      : "Waiting for the first preview. Image generation can take a little while.";
  } else if (isComplete) {
    status = "Image ready";
    description = "Open the image to view it at full size.";
  } else if (hasFinalOutput) {
    status = hasLoadError
      ? "Image could not be loaded"
      : nextImageSrc
        ? "Loading finished image"
        : "No image returned";
    description = hasLoadError
      ? "The finished image could not be loaded. Reload the page to try again."
      : nextImageSrc
        ? "The finished image is loading."
        : "Send a new message to try again.";
  } else if (isFailed) {
    status = "Image generation failed";
    description = part.errorText || "The image could not be generated. Send a new message to try again.";
  } else if (isDenied) {
    status = "Image generation declined";
    description = "This image generation request was not approved.";
  } else if (needsApproval) {
    status = "Awaiting approval";
    description = "Image generation will start once the request is approved.";
  }

  const StatusIcon = isRunning
    ? LoaderCircleIcon
    : isFailed || isDenied || hasLoadError
      ? XIcon
      : isComplete && imageSrc
        ? CheckIcon
        : ImageIcon;
  const downloadName = `generated-image-${part.toolCallId}.webp`;

  return (
    <div className="message-tool-part overflow-hidden rounded-md border bg-background/80">
      <div className="flex items-center gap-3 px-3 py-3">
        <ImageIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 grow">
          <p className="text-sm font-medium">Image generation</p>
          <output
            className={cn(
              "mt-1 flex items-center gap-1.5 text-xs text-muted-foreground",
              (isFailed || hasLoadError) && "text-destructive",
            )}
          >
            <StatusIcon
              aria-hidden="true"
              className={cn("size-3.5 shrink-0", isRunning && "motion-safe:animate-spin")}
            />
            {status}
          </output>
        </div>
        {isComplete && imageSrc && (
          <button
            type="button"
            onClick={() => void downloadImage({ src: imageSrc, downloadName })}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <DownloadIcon aria-hidden="true" className="size-4" />
            Download
          </button>
        )}
      </div>

      {imageSrc ? (
        <ImageLightboxProvider images={[{ src: imageSrc, alt: "Generated image", downloadName }]}>
          <ImageLightboxTrigger
            index={0}
            aria-label={isComplete ? "View generated image" : "View image preview"}
            className="flex w-full border-t border-border/60 bg-muted/30 focus-visible:ring-0"
          >
            <img
              src={imageSrc}
              alt={isComplete ? "Generated image" : "Image generation preview"}
              className="max-h-96 w-full object-contain"
            />
          </ImageLightboxTrigger>
        </ImageLightboxProvider>
      ) : isRunning ? (
        <div
          aria-hidden="true"
          className="flex h-40 items-center justify-center border-t border-border/60 bg-muted/30 motion-safe:animate-pulse"
        >
          <ImageIcon className="size-10 text-muted-foreground/50" strokeWidth={1} />
        </div>
      ) : null}

      <p className="px-3 py-3 text-xs break-words text-muted-foreground">{description}</p>
    </div>
  );
}
