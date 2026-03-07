"use client";

import { Button } from "@base-ui/react/button";
import { Dialog } from "@base-ui/react/dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ImagesIcon,
  XIcon,
} from "lucide-react";
import type { Transition } from "motion/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";

import { cn, format } from "@/lib/utils";

export function extractNameFromUrl(url: string) {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

export type LightboxImage = {
  id?: string;
  src: string;
  clipboardSrc?: string;
  downloadSrc?: string;
  thumbnailSrc?: string;
  alt?: string;
  name?: string;
  bytes?: number;
  width?: number;
  height?: number;
  downloadName?: string;
};

type LightboxPayload = { index: number };
type LightboxHandle = ReturnType<typeof Dialog.createHandle<LightboxPayload>>;

const LightboxHandleContext = React.createContext<LightboxHandle | null>(null);

export type ImageLightboxProviderProps = {
  images: LightboxImage[];
  children: React.ReactNode;
};

export function ImageLightboxProvider(props: ImageLightboxProviderProps) {
  const { images, children } = props;

  const handle = React.useMemo(() => Dialog.createHandle<LightboxPayload>(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <LightboxHandleContext.Provider value={handle}>
      {children}

      <Dialog.Root handle={handle} open={open} onOpenChange={setOpen}>
        {({ payload }) =>
          open ? <ImageLightboxDialog images={images} initialIndex={payload?.index ?? 0} /> : null
        }
      </Dialog.Root>
    </LightboxHandleContext.Provider>
  );
}

export type ImageLightboxTriggerProps = React.ComponentProps<typeof Dialog.Trigger> & {
  index: number;
};

export function ImageLightboxTrigger(props: ImageLightboxTriggerProps) {
  const { index, children, className } = props;

  const handle = React.useContext(LightboxHandleContext);
  if (!handle) {
    throw new Error("ImageLightboxTrigger must be used within ImageLightboxProvider.");
  }

  return (
    <Dialog.Trigger
      handle={handle}
      payload={{ index }}
      className={cn(
        "inline-flex cursor-zoom-in bg-transparent p-0 outline-none select-none focus-visible:ring-2 focus-visible:ring-white/50",
        className,
      )}
    >
      {children}
    </Dialog.Trigger>
  );
}

type ImageLightboxDialogProps = {
  images: LightboxImage[];
  initialIndex: number;
};

type ImageLoadState = "loading" | "loaded" | "error";
type NavigationDirection = -1 | 0 | 1;

function ImageLightboxDialog(props: ImageLightboxDialogProps) {
  const { images, initialIndex } = props;

  const [activeIndex, setActiveIndex] = React.useState(() =>
    wrapIndex(initialIndex, images.length),
  );
  const [naturalSize, setNaturalSize] = React.useState<{ width: number; height: number } | null>(
    null,
  );
  const [imageLoadState, setImageLoadState] = React.useState<ImageLoadState>("loading");
  const [retryVersion, setRetryVersion] = React.useState(0);
  const [navigationDirection, setNavigationDirection] = React.useState<NavigationDirection>(0);

  const zoomRef = React.useRef<ZoomableImageHandle | null>(null);
  const thumbsRef = React.useRef<HTMLDivElement | null>(null);
  const dialogTitleId = React.useId();
  const dialogDescriptionId = React.useId();
  const prefersReducedMotion = useReducedMotion();

  React.useEffect(() => {
    setActiveIndex(wrapIndex(initialIndex, images.length));
  }, [initialIndex, images.length]);

  React.useEffect(() => {
    zoomRef.current?.reset();
    setNaturalSize(null);
    setImageLoadState("loading");
  }, [activeIndex]);

  React.useEffect(() => {
    setActiveIndex((i) => wrapIndex(i, images.length));
  }, [images.length]);

  const hasMultipleImages = images.length > 1;

  const goPrev = React.useCallback(() => {
    if (!hasMultipleImages) return;
    setNavigationDirection(-1);
    setActiveIndex((i) => wrapIndex(i - 1, images.length));
  }, [hasMultipleImages, images.length]);

  const goNext = React.useCallback(() => {
    if (!hasMultipleImages) return;
    setNavigationDirection(1);
    setActiveIndex((i) => wrapIndex(i + 1, images.length));
  }, [hasMultipleImages, images.length]);

  const onThumbClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!hasMultipleImages) return;
      const raw = e.currentTarget.dataset.index;
      const idx = raw ? Number(raw) : Number.NaN;
      if (!Number.isFinite(idx)) return;
      setNavigationDirection(getShortestNavigationDirection(activeIndex, idx, images.length));
      setActiveIndex(wrapIndex(idx, images.length));
    },
    [activeIndex, hasMultipleImages, images.length],
  );

  React.useEffect(() => {
    if (!hasMultipleImages) return;
    const el = thumbsRef.current?.querySelector<HTMLButtonElement>(
      `button[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeIndex, hasMultipleImages]);

  React.useEffect(() => {
    if (!hasMultipleImages) return;
    const next = images[wrapIndex(activeIndex + 1, images.length)];
    const prev = images[wrapIndex(activeIndex - 1, images.length)];

    if (typeof window === "undefined") return;

    const img1 = new Image();
    img1.decoding = "async";
    img1.src = next!.src;

    const img2 = new Image();
    img2.decoding = "async";
    img2.src = prev!.src;
  }, [activeIndex, hasMultipleImages, images]);

  const handleDialogKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!hasMultipleImages) return;

      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (shouldIgnoreLightboxArrowKeyTarget(e.target)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        goNext();
      }
    },
    [goPrev, goNext, hasMultipleImages],
  );

  if (images.length === 0) return null;

  const active = images[activeIndex]!;
  const activeTitle = active.name ?? "Image viewer";

  const resolvedWidth = active.width ?? naturalSize?.width;
  const resolvedHeight = active.height ?? naturalSize?.height;

  const metaParts: string[] = [];
  if (typeof active.bytes === "number") metaParts.push(format.size(active.bytes));
  if (resolvedWidth && resolvedHeight) metaParts.push(`${resolvedWidth}×${resolvedHeight}`);
  const meta = metaParts.join(" · ");
  const imagePositionLabel = hasMultipleImages
    ? `${activeIndex + 1} of ${images.length}`
    : "Single image";
  const liveMessageParts = [imagePositionLabel, activeTitle, meta].filter(Boolean);
  const liveMessage = liveMessageParts.join(" - ");
  const dialogDescription = hasMultipleImages
    ? "Use left and right arrow keys to switch between images."
    : "Zoom and inspect the image.";

  const actionBtn =
    "rounded-md bg-white/10 p-2 border text-xs font-medium text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
  const imageClassName = hasMultipleImages
    ? "max-h-[min(68vh,calc(100dvh-20rem))] max-w-[80vw]"
    : "max-h-[min(80vh,calc(100dvh-14rem))] max-w-[80vw]";
  const slideTransition: Transition = prefersReducedMotion
    ? { duration: 0.16 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

  function handleRetryImageLoad() {
    setRetryVersion((value) => value + 1);
    setNaturalSize(null);
    setImageLoadState("loading");
  }

  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-9998 bg-black/80" />

      <Dialog.Popup
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        onKeyDownCapture={handleDialogKeyDown}
        className="pointer-events-none fixed inset-0 z-9999 outline-none"
      >
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          <div className="sr-only">
            <div id={dialogTitleId}>{activeTitle}</div>
            <div id={dialogDescriptionId}>{dialogDescription}</div>
            <div aria-live="polite" aria-atomic="true">
              {liveMessage}
            </div>
          </div>

          <div className="pointer-events-none flex shrink-0 justify-end p-4">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg bg-black/60 p-2 backdrop-blur">
              <Button
                title="Download image"
                className={actionBtn}
                onClick={() => void downloadImage(active)}
              >
                <DownloadIcon className="size-4" />
                <span className="sr-only">Download</span>
              </Button>

              <Button
                title="Copy URL"
                className={actionBtn}
                onClick={() => void copyText(active.src)}
              >
                <CopyIcon className="size-4" />
                <span className="sr-only">Copy URL</span>
              </Button>

              <Button
                title="Open in new tab"
                className={actionBtn}
                onClick={() => openInNewTab(active.src)}
              >
                <ExternalLinkIcon className="size-4" />
                <span className="sr-only">New tab</span>
              </Button>

              <Button
                title="Copy image"
                className={actionBtn}
                onClick={() => void copyImage(active)}
              >
                <ImagesIcon className="size-4" />
                <span className="sr-only">Copy image</span>
              </Button>

              <Dialog.Close
                title="Close"
                className={cn(actionBtn, "bg-white/15 hover:bg-white/20")}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          </div>

          <div
            className={cn(
              "pointer-events-none relative flex min-h-0 flex-1 items-center justify-center px-6",
              hasMultipleImages && "pb-4",
            )}
          >
            {hasMultipleImages && (
              <Button
                aria-label="Previous image"
                className="pointer-events-auto absolute top-1/2 left-4 -translate-y-1/2 rounded-md border bg-black/60 p-3 text-white backdrop-blur hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                onClick={goPrev}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
            )}

            <div className="pointer-events-auto flex min-h-0 flex-1 items-center justify-center self-stretch">
              <div className="flex max-w-full flex-col items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <AnimatePresence initial={false} custom={navigationDirection} mode="wait">
                    <motion.div
                      key={`${active.src}-${retryVersion}`}
                      custom={navigationDirection}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: navigationDirection >= 0 ? 32 : -32,
                            }
                      }
                      animate={{ opacity: 1, x: 0 }}
                      exit={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: navigationDirection >= 0 ? -32 : 32,
                            }
                      }
                      transition={slideTransition}
                      className="relative flex items-center justify-center"
                    >
                      <ZoomableImage
                        ref={zoomRef}
                        src={active.src}
                        alt={active.alt ?? active.name ?? "Image"}
                        onNaturalSize={setNaturalSize}
                        onLoadStateChange={setImageLoadState}
                        className={imageClassName}
                      />

                      {imageLoadState === "loading" && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/30 text-sm font-medium text-white/90 backdrop-blur-sm">
                          Loading image...
                        </div>
                      )}

                      {imageLoadState === "error" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md bg-black/70 px-4 text-center text-white backdrop-blur-sm">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">Unable to load image</div>
                            <div className="text-xs text-white/70">
                              Try again or open the original file in a new tab.
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button className={actionBtn} onClick={handleRetryImageLoad}>
                              Retry
                            </Button>
                            <Button className={actionBtn} onClick={() => openInNewTab(active.src)}>
                              Open in new tab
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="relative z-10 flex shrink-0 flex-col items-center rounded-lg bg-black/55 px-3 py-2 text-center text-white backdrop-blur-sm">
                  <div className="text-xs text-white/70">{imagePositionLabel}</div>
                  <div className="max-w-[80vw] truncate text-sm font-medium">
                    {active.name ?? "Untitled"}
                  </div>

                  {meta ? <div className="text-xs text-white/70">{meta}</div> : null}
                </div>
              </div>
            </div>

            {hasMultipleImages && (
              <Button
                aria-label="Next image"
                className="pointer-events-auto absolute top-1/2 right-4 -translate-y-1/2 rounded-md border bg-black/60 p-3 text-white backdrop-blur hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                onClick={goNext}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            )}
          </div>

          {hasMultipleImages && (
            <div className="pointer-events-none shrink-0 px-4 pb-4">
              <div
                ref={thumbsRef}
                aria-label="Image thumbnails"
                className="pointer-events-auto mx-auto w-fit max-w-full overflow-x-auto rounded-lg bg-black/60 p-2 backdrop-blur"
              >
                <div className="flex w-max items-center gap-2">
                  {images.map((img, i) => {
                    const isActive = i === activeIndex;
                    const src = img.thumbnailSrc ?? img.src;

                    return (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        data-index={i}
                        onClick={onThumbClick}
                        aria-current={isActive ? "true" : undefined}
                        aria-pressed={isActive}
                        className={cn(
                          "h-14 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                          isActive ? "scale-110 ring-white/40" : "hover:scale-105",
                        )}
                        aria-label={img.name ? `View ${img.name}` : `View image ${i + 1}`}
                      >
                        <img
                          src={src}
                          alt={img.alt ?? img.name ?? `Thumbnail ${i + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

type ZoomableImageHandle = {
  reset: () => void;
};

type ZoomableImageProps = {
  src: string;
  alt: string;
  className?: string;
  minScale?: number;
  maxScale?: number;
  onNaturalSize?: (size: { width: number; height: number }) => void;
  onLoadStateChange?: (state: ImageLoadState) => void;
};

const ZoomableImage = React.forwardRef<ZoomableImageHandle, ZoomableImageProps>(
  function ZoomableImage(props, ref) {
    const {
      src,
      alt,
      className,
      minScale = 0.2,
      maxScale = 8,
      onNaturalSize,
      onLoadStateChange,
    } = props;

    const imgRef = React.useRef<HTMLImageElement | null>(null);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const rafRef = React.useRef<number | null>(null);

    const stateRef = React.useRef({ scale: 1, x: 0, y: 0 });

    const dragRef = React.useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      startTranslateX: number;
      startTranslateY: number;
    } | null>(null);

    const clampPosition = React.useCallback((nextX: number, nextY: number, nextScale: number) => {
      const img = imgRef.current;
      const viewport = viewportRef.current;
      if (!img || !viewport || nextScale <= 1) {
        return { x: 0, y: 0 };
      }

      const baseWidth = img.clientWidth;
      const baseHeight = img.clientHeight;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      if (baseWidth <= 0 || baseHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        return { x: nextX, y: nextY };
      }

      const maxOffsetX = Math.max(0, (baseWidth * nextScale - viewportWidth) / 2);
      const maxOffsetY = Math.max(0, (baseHeight * nextScale - viewportHeight) / 2);

      return {
        x: clamp(nextX, -maxOffsetX, maxOffsetX),
        y: clamp(nextY, -maxOffsetY, maxOffsetY),
      };
    }, []);

    const applyNow = React.useCallback(() => {
      const el = imgRef.current;
      if (!el) return;

      const { scale, x, y } = stateRef.current;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      el.style.transformOrigin = "center center";
      el.style.cursor = scale > 1 ? "grab" : "zoom-in";
    }, []);

    const scheduleApply = React.useCallback(() => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyNow();
      });
    }, [applyNow]);

    const reset = React.useCallback(() => {
      stateRef.current.scale = 1;
      stateRef.current.x = 0;
      stateRef.current.y = 0;
      applyNow();
    }, [applyNow]);

    React.useImperativeHandle(
      ref,
      () => ({
        reset,
      }),
      [reset],
    );

    React.useEffect(() => {
      reset();
    }, [src, reset]);

    React.useEffect(() => {
      const el = imgRef.current;
      if (!el || !el.complete || el.naturalWidth <= 0 || el.naturalHeight <= 0) return;

      onLoadStateChange?.("loaded");
      onNaturalSize?.({ width: el.naturalWidth, height: el.naturalHeight });
    }, [onLoadStateChange, onNaturalSize, src]);

    React.useEffect(() => {
      const el = imgRef.current;
      if (!el) return;

      function onWheel(e: WheelEvent) {
        e.preventDefault();

        const factor = Math.exp(-e.deltaY * 0.001);
        const nextScale = clamp(stateRef.current.scale * factor, minScale, maxScale);
        const nextPosition = clampPosition(stateRef.current.x, stateRef.current.y, nextScale);

        stateRef.current.scale = nextScale;
        stateRef.current.x = nextPosition.x;
        stateRef.current.y = nextPosition.y;

        if (nextScale <= 1) {
          stateRef.current.x = 0;
          stateRef.current.y = 0;
        }

        scheduleApply();
      }

      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [clampPosition, maxScale, minScale, scheduleApply]);

    React.useEffect(() => {
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
      if (e.button !== 0) return;
      const el = imgRef.current;
      if (!el) return;
      if (stateRef.current.scale <= 1) return;

      el.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTranslateX: stateRef.current.x,
        startTranslateY: stateRef.current.y,
      };

      el.style.cursor = "grabbing";
    }

    function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (stateRef.current.scale <= 1) return;

      const nextPosition = clampPosition(
        drag.startTranslateX + (e.clientX - drag.startX),
        drag.startTranslateY + (e.clientY - drag.startY),
        stateRef.current.scale,
      );
      stateRef.current.x = nextPosition.x;
      stateRef.current.y = nextPosition.y;
      scheduleApply();
    }

    function onPointerUp(e: React.PointerEvent<HTMLImageElement>) {
      const el = imgRef.current;
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      if (el?.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }

      dragRef.current = null;
      applyNow();
    }

    function onDoubleClick() {
      reset();
    }

    function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
      onLoadStateChange?.("loaded");
      if (!onNaturalSize) return;
      const el = e.currentTarget;
      if (el.naturalWidth && el.naturalHeight) {
        onNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
      }
    }

    function onError() {
      onLoadStateChange?.("error");
    }

    return (
      <div
        ref={viewportRef}
        className="relative flex size-full min-h-0 items-center justify-center rounded-md"
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={onLoad}
          onError={onError}
          onDoubleClick={onDoubleClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "block touch-none rounded-md object-contain will-change-transform select-none",
            className,
          )}
        />
      </div>
    );
  },
);

function shouldIgnoreLightboxArrowKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return !!target.closest("input, textarea, select, [contenteditable='true']");
}

function isClipboardImageWriteSupported(): boolean {
  const hasSecure = typeof window !== "undefined" && window.isSecureContext;
  const hasWrite = typeof navigator !== "undefined" && !!navigator.clipboard?.write;
  const hasItem = typeof window.ClipboardItem !== "undefined";

  return hasSecure && hasWrite && hasItem;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  const mod = index % length;
  return mod < 0 ? mod + length : mod;
}

function getShortestNavigationDirection(
  currentIndex: number,
  nextIndex: number,
  length: number,
): NavigationDirection {
  if (length <= 1 || currentIndex === nextIndex) return 0;

  const forwardSteps = (nextIndex - currentIndex + length) % length;
  const backwardSteps = (currentIndex - nextIndex + length) % length;

  if (forwardSteps === backwardSteps) {
    return nextIndex > currentIndex ? 1 : -1;
  }

  return forwardSteps < backwardSteps ? 1 : -1;
}

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) return;
  await navigator.clipboard.writeText(text);
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function resolveClipboardImageUrl(img: LightboxImage): string {
  if (img.clipboardSrc) return img.clipboardSrc;

  return img.src.replace(
    "https://ik.imagekit.io/gmethsnvl/ai-chat/",
    "https://files.chat.asakuri.me/",
  );
}

async function copyImage(img: LightboxImage) {
  if (!isClipboardImageWriteSupported()) {
    return toast.error("Copying image is not supported in this browser.", {
      position: "top-center",
      duration: 3000,
    });
  }

  const fileUrl = resolveClipboardImageUrl(img);

  const htmlImage = new Image();
  htmlImage.crossOrigin = "anonymous"; // requires proper CORS headers from the server
  htmlImage.decoding = "async";
  htmlImage.src = fileUrl;

  try {
    // Prefer decode(); fallback to onload for older browsers
    if (typeof htmlImage.decode === "function") {
      await htmlImage.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        htmlImage.onload = () => resolve();
        htmlImage.onerror = () => reject(new Error("Failed to load image"));
      });
    }
  } catch {
    toast.error("Failed to load image.", { position: "top-center", duration: 3000 });
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = htmlImage.naturalWidth || htmlImage.width;
  canvas.height = htmlImage.naturalHeight || htmlImage.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    toast.error("Unable to create drawing context.", { position: "top-center", duration: 3000 });
    return;
  }

  ctx.drawImage(htmlImage, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );

  if (!blob) {
    toast.error(
      "Could not create image blob. If this is a cross-origin image, ensure the server allows CORS.",
      { position: "top-center" },
    );
    return;
  }

  const clipboardItem = new ClipboardItem({ [blob.type]: blob });

  await navigator.clipboard.write([clipboardItem]);
  toast.success("Image copied to clipboard", { position: "top-center", duration: 3000 });
  canvas.remove();
}

async function downloadImage(img: LightboxImage) {
  const name = img.downloadName ?? img.name ?? "image";
  const downloadUrl = img.downloadSrc ?? img.src;

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    triggerDownload(objectUrl, name);

    // Revoke on next tick so the download can start.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    toast.success("Image downloaded", { position: "top-center", duration: 3000 });
  } catch {
    triggerDownload(downloadUrl, name);
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();

  setTimeout(() => a.remove(), 100);
}
