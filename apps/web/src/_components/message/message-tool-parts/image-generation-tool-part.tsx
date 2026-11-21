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
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (nextImageSrc && nextImageSrc !== imageSrc) {
      const image = new Image();
      image.src = nextImageSrc;
      void image
        .decode()
        .then(() => {
          if (cancelled) return undefined;
          setImageSrc(nextImageSrc);
          setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
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
  let description: string | null = "Send a new message to try again.";
  if (isRunning) {
    status = imageSrc ? "Refining image" : "Generating image";
    description = imageSrc ? "Preview. The finished image replaces it." : "This can take up to a minute.";
  } else if (isComplete) {
    status = "Generated image";
    description = null;
  } else if (hasFinalOutput) {
    status = hasLoadError
      ? "Image could not be loaded"
      : nextImageSrc
        ? "Loading finished image"
        : "No image returned";
    description = hasLoadError
      ? "Reload the page to try again."
      : nextImageSrc
        ? null
        : "Send a new message to try again.";
  } else if (isFailed) {
    status = "Image generation failed";
    description = part.errorText || "Send a new message to try again.";
  } else if (isDenied) {
    status = "Image generation declined";
    description = "The request was not approved.";
  } else if (needsApproval) {
    status = "Waiting for approval";
    description = "Generation starts once you approve the request.";
  }

  const isError = isFailed || hasLoadError;
  const StatusIcon = isRunning
    ? LoaderCircleIcon
    : isFailed || isDenied || hasLoadError
      ? XIcon
      : isComplete
        ? CheckIcon
        : ImageIcon;
  const downloadName = `generated-image-${part.toolCallId}.webp`;
  const showFrame = imageSrc !== null || isRunning;

  return (
    <figure
      className={cn(
        "message-tool-part flex max-w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-background/80 backdrop-blur-md backdrop-saturate-150",
        showFrame ? "w-fit min-w-72" : "w-full",
      )}
    >
      {imageSrc ? (
        <div className="relative bg-black/20">
          <ImageLightboxProvider images={[{ src: imageSrc, alt: "Generated image", downloadName }]}>
            <ImageLightboxTrigger
              index={0}
              aria-label={isComplete ? "View generated image" : "View image preview"}
              className="flex w-full justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <img
                src={imageSrc}
                alt={isComplete ? "Generated image" : "Image generation preview"}
                width={imageSize?.width}
                height={imageSize?.height}
                className={cn(
                  "block h-auto max-h-[28rem] w-auto max-w-full object-contain transition-[filter] duration-500",
                  !isComplete && "saturate-[.85]",
                )}
              />
            </ImageLightboxTrigger>
          </ImageLightboxProvider>
          {isRunning && (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-foreground/10"
            >
              <div className="h-full w-1/2 bg-foreground/60 motion-safe:animate-image-develop" />
            </div>
          )}
        </div>
      ) : isRunning ? (
        <div
          aria-hidden="true"
          className="relative flex aspect-square w-80 max-w-full items-center justify-center overflow-hidden bg-muted/40"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent motion-safe:animate-image-develop" />
          <ImageIcon className="size-8 text-muted-foreground/40" strokeWidth={1.25} />
        </div>
      ) : null}

      <figcaption
        className={cn("flex min-w-0 items-start gap-3 px-3 py-2", showFrame && "border-t border-border/60")}
      >
        <div className="min-w-0 grow">
          <output
            className={cn(
              "flex min-h-7 items-center gap-1.5 text-xs font-medium text-foreground/85",
              isError && "text-destructive",
            )}
          >
            <StatusIcon
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0",
                isRunning && "motion-safe:animate-spin",
                !isError && "text-muted-foreground",
              )}
            />
            {status}
            {isComplete && imageSize && (
              <span className="ml-1 font-normal text-muted-foreground tabular-nums">
                {imageSize.width}×{imageSize.height}
              </span>
            )}
          </output>
          {description && <p className="pl-5 text-xs break-words text-muted-foreground">{description}</p>}
        </div>
        {isComplete && imageSrc && (
          <button
            type="button"
            onClick={() => void downloadImage({ src: imageSrc, downloadName })}
            className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <DownloadIcon aria-hidden="true" className="size-3.5" />
            Download
          </button>
        )}
      </figcaption>
    </figure>
  );
}
