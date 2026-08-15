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
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import type { Transition } from "motion/react";
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import * as React from "react";

import { cn, format } from "@/lib/utils";

import { copyImage, copyText, downloadImage, openInNewTab, resolvePrimaryActionUrl } from "./actions";
import type { ImageLoadState, LightboxImage, NavigationDirection } from "./types";
import { getShortestNavigationDirection, wrapIndex } from "./utils";
import { ZoomableImage, type ZoomableImageHandle } from "./zoomable-image";

const actionButtonClassName =
  "rounded-md border bg-white/10 p-2 text-xs font-medium text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 [&_svg]:size-4";

type ImageLightboxDialogProps = {
  images: LightboxImage[];
  initialIndex: number;
};

type ActiveImageState = {
  key: string;
  loadState: ImageLoadState;
  naturalSize: { width: number; height: number } | null;
};

export function ImageLightboxDialog(props: ImageLightboxDialogProps) {
  const { images, initialIndex } = props;
  const [activeIndex, setActiveIndex] = React.useState(() => wrapIndex(initialIndex, images.length));
  const [imageState, setImageState] = React.useState<ActiveImageState>({
    key: "",
    loadState: "loading",
    naturalSize: null,
  });
  const [retryVersion, setRetryVersion] = React.useState(0);
  const [navigationDirection, setNavigationDirection] = React.useState<NavigationDirection>(0);
  const zoomRef = React.useRef<ZoomableImageHandle | null>(null);
  const dialogTitleId = React.useId();
  const dialogDescriptionId = React.useId();
  const prefersReducedMotion = useReducedMotion();
  const safeActiveIndex = wrapIndex(activeIndex, images.length);
  const active = images[safeActiveIndex];
  const hasMultipleImages = images.length > 1;

  React.useEffect(() => {
    if (!hasMultipleImages) return;
    const next = images[wrapIndex(safeActiveIndex + 1, images.length)];
    const previous = images[wrapIndex(safeActiveIndex - 1, images.length)];

    for (const image of [next, previous]) {
      if (!image) continue;
      const preload = new Image();
      preload.decoding = "async";
      preload.src = image.src;
    }
  }, [hasMultipleImages, images, safeActiveIndex]);

  if (images.length === 0) return null;

  if (!active) return null;

  const activeKey = `${active.id ?? safeActiveIndex}-${active.src}`;
  const activeImageState =
    imageState.key === activeKey
      ? imageState
      : { key: activeKey, loadState: "loading" as const, naturalSize: null };
  const activeActionUrl = resolvePrimaryActionUrl(active);
  const activeTitle = active.name ?? "Image viewer";
  const resolvedWidth = active.width ?? activeImageState.naturalSize?.width;
  const resolvedHeight = active.height ?? activeImageState.naturalSize?.height;
  const metadata = [
    typeof active.bytes === "number" ? format.size(active.bytes) : "",
    resolvedWidth && resolvedHeight ? `${resolvedWidth}×${resolvedHeight}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const positionLabel = hasMultipleImages ? `${safeActiveIndex + 1} of ${images.length}` : "Single image";
  const liveMessage = [positionLabel, activeTitle, metadata].filter(Boolean).join(" - ");
  const description = hasMultipleImages
    ? "Use left and right arrow keys to switch images. Use the zoom controls, mouse wheel, or pinch gesture to zoom."
    : "Use the zoom controls, mouse wheel, or pinch gesture to zoom and inspect the image.";
  const imageClassName = hasMultipleImages
    ? "max-h-[min(68vh,calc(100dvh-20rem))] max-w-[80vw]"
    : "max-h-[min(80vh,calc(100dvh-14rem))] max-w-[80vw]";
  const slideTransition: Transition = prefersReducedMotion
    ? { duration: 0.16 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

  function navigateTo(nextIndex: number, direction: NavigationDirection): void {
    setNavigationDirection(direction);
    setActiveIndex(wrapIndex(nextIndex, images.length));
  }

  function goPrevious(): void {
    if (hasMultipleImages) navigateTo(safeActiveIndex - 1, -1);
  }

  function goNext(): void {
    if (hasMultipleImages) navigateTo(safeActiveIndex + 1, 1);
  }

  function handleThumbnailClick(event: React.MouseEvent<HTMLButtonElement>): void {
    const index = Number(event.currentTarget.dataset.index);
    if (!hasMultipleImages || !Number.isInteger(index)) return;
    navigateTo(index, getShortestNavigationDirection(safeActiveIndex, index, images.length));
  }

  function handleDialogKeyDown(event: React.KeyboardEvent): void {
    if (
      !hasMultipleImages ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      shouldIgnoreArrowKeyTarget(event.target)
    ) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowLeft") goPrevious();
      else goNext();
    }
  }

  function handleRetry(): void {
    setRetryVersion((version) => version + 1);
    setImageState({ key: activeKey, loadState: "loading", naturalSize: null });
  }

  function handleNaturalSize(naturalSize: { width: number; height: number }): void {
    setImageState((current) => ({
      key: activeKey,
      loadState: current.key === activeKey ? current.loadState : "loading",
      naturalSize,
    }));
  }

  function handleLoadStateChange(loadState: ImageLoadState): void {
    setImageState((current) => ({
      key: activeKey,
      loadState,
      naturalSize: current.key === activeKey ? current.naturalSize : null,
    }));
  }

  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80" />
      <Dialog.Popup
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        onKeyDownCapture={handleDialogKeyDown}
        className="pointer-events-none fixed inset-0 z-50 overscroll-contain outline-none"
      >
        <div className="pointer-events-none absolute inset-0 isolate flex flex-col">
          <div className="sr-only">
            <h2 id={dialogTitleId}>{activeTitle}</h2>
            <p id={dialogDescriptionId}>{description}</p>
            <div aria-live="polite" aria-atomic="true">
              {liveMessage}
            </div>
          </div>

          <LightboxToolbar active={active} activeActionUrl={activeActionUrl} zoomRef={zoomRef} />

          <div className="pointer-events-none relative flex min-h-0 flex-1 items-center justify-center px-6">
            {hasMultipleImages && <NavigationButton direction="previous" onClick={goPrevious} />}

            <div className="pointer-events-auto size-full min-h-0 overflow-hidden">
              <LazyMotion features={domAnimation} strict>
                <AnimatePresence initial={false} custom={navigationDirection} mode="wait">
                  <m.div
                    key={`${activeKey}-${retryVersion}`}
                    custom={navigationDirection}
                    initial={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: navigationDirection >= 0 ? 32 : -32 }
                    }
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: navigationDirection >= 0 ? -32 : 32 }
                    }
                    transition={slideTransition}
                    className="relative flex size-full items-center justify-center"
                  >
                    <ZoomableImage
                      ref={zoomRef}
                      src={active.src}
                      alt={active.alt ?? active.name ?? "Image"}
                      onNaturalSize={handleNaturalSize}
                      onLoadStateChange={handleLoadStateChange}
                      className={imageClassName}
                    />

                    {activeImageState.loadState === "loading" && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-white/90">
                        <span className="rounded-md bg-black/60 px-3 py-2 backdrop-blur-sm">Loading…</span>
                      </div>
                    )}

                    {activeImageState.loadState === "error" && (
                      <ImageErrorState activeActionUrl={activeActionUrl} onRetry={handleRetry} />
                    )}
                  </m.div>
                </AnimatePresence>
              </LazyMotion>
            </div>

            {hasMultipleImages && <NavigationButton direction="next" onClick={goNext} />}
          </div>

          <LightboxFooter
            active={active}
            activeIndex={safeActiveIndex}
            images={images}
            metadata={metadata}
            positionLabel={positionLabel}
            onThumbnailClick={handleThumbnailClick}
          />
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

type LightboxToolbarProps = {
  active: LightboxImage;
  activeActionUrl: string;
  zoomRef: React.RefObject<ZoomableImageHandle | null>;
};

function LightboxToolbar(props: LightboxToolbarProps) {
  const { active, activeActionUrl, zoomRef } = props;

  return (
    <div className="pointer-events-none relative z-10 flex shrink-0 justify-end p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-md bg-black/60 p-2 backdrop-blur">
        <ToolbarButton label="Zoom in" onClick={() => zoomRef.current?.zoomIn()}>
          <PlusIcon aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Zoom out" onClick={() => zoomRef.current?.zoomOut()}>
          <MinusIcon aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Reset zoom" onClick={() => zoomRef.current?.reset()}>
          <RotateCcwIcon aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Download image" onClick={() => void downloadImage(active)}>
          <DownloadIcon aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Copy URL" onClick={() => void copyText(activeActionUrl)}>
          <CopyIcon aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Open in new tab" onClick={() => openInNewTab(activeActionUrl)}>
          <ExternalLinkIcon aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Copy image" onClick={() => void copyImage(active)}>
          <ImagesIcon aria-hidden="true" />
        </ToolbarButton>
        <Dialog.Close
          aria-label="Close"
          title="Close"
          className={cn(actionButtonClassName, "bg-white/15 hover:bg-white/20")}
        >
          <XIcon aria-hidden="true" />
        </Dialog.Close>
      </div>
    </div>
  );
}

type ToolbarButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <Button
      aria-label={props.label}
      title={props.label}
      className={actionButtonClassName}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
}

type NavigationButtonProps = {
  direction: "previous" | "next";
  onClick: () => void;
};

function NavigationButton(props: NavigationButtonProps) {
  const isPrevious = props.direction === "previous";

  return (
    <Button
      aria-label={isPrevious ? "Previous image" : "Next image"}
      className={cn(
        "pointer-events-auto absolute top-1/2 z-10 -translate-y-1/2 rounded-md border bg-black/60 p-3 text-white backdrop-blur hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 [&_svg]:size-4",
        isPrevious ? "left-4" : "right-4",
      )}
      onClick={props.onClick}
    >
      {isPrevious ? <ChevronLeftIcon aria-hidden="true" /> : <ChevronRightIcon aria-hidden="true" />}
    </Button>
  );
}

type ImageErrorStateProps = {
  activeActionUrl: string;
  onRetry: () => void;
};

function ImageErrorState(props: ImageErrorStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center text-white backdrop-blur-sm">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">Unable to load image</div>
        <div className="text-xs text-white/70">Try again or open the original file in a new tab.</div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button className={actionButtonClassName} onClick={props.onRetry}>
          Retry
        </Button>
        <Button className={actionButtonClassName} onClick={() => openInNewTab(props.activeActionUrl)}>
          Open in new tab
        </Button>
      </div>
    </div>
  );
}

type LightboxFooterProps = {
  active: LightboxImage;
  activeIndex: number;
  images: LightboxImage[];
  metadata: string;
  positionLabel: string;
  onThumbnailClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function LightboxFooter(props: LightboxFooterProps) {
  const thumbnailsRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const activeThumbnail = thumbnailsRef.current?.querySelector<HTMLButtonElement>(
      `button[data-index="${props.activeIndex}"]`,
    );
    activeThumbnail?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [props.activeIndex]);

  return (
    <div className="pointer-events-none relative z-10 shrink-0 px-4 pb-4">
      <div className="pointer-events-auto mx-auto flex w-fit max-w-full flex-col items-center gap-2">
        <div className="flex shrink-0 flex-col items-center rounded-md bg-black/55 px-3 py-2 text-center text-white backdrop-blur-sm">
          <div className="text-xs text-white/70">{props.positionLabel}</div>
          <div className="max-w-[80vw] truncate text-sm font-medium">{props.active.name ?? "Untitled"}</div>
          {props.metadata && <div className="text-xs text-white/70">{props.metadata}</div>}
        </div>

        {props.images.length > 1 && (
          <div
            ref={thumbnailsRef}
            aria-label="Image thumbnails"
            className="w-fit max-w-full overflow-x-auto overscroll-x-contain rounded-md bg-black/60 p-2 backdrop-blur"
          >
            <div className="flex w-max items-center gap-2">
              {props.images.map((image, index) => {
                const isActive = index === props.activeIndex;
                const src = image.thumbnailSrc ?? image.src;

                return (
                  <button
                    key={image.id ?? `${src}-${image.name ?? ""}-${image.downloadSrc ?? ""}`}
                    type="button"
                    data-index={index}
                    onClick={props.onThumbnailClick}
                    aria-current={isActive ? "true" : undefined}
                    aria-pressed={isActive}
                    className={cn(
                      "size-14 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                      isActive ? "scale-110 ring-white/40" : "hover:scale-105",
                    )}
                    aria-label={image.name ? `View ${image.name}` : `View image ${index + 1}`}
                  >
                    <img
                      src={src}
                      alt=""
                      width={56}
                      height={56}
                      className="size-full object-cover"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function shouldIgnoreArrowKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest("input, textarea, select, [contenteditable='true']");
}
