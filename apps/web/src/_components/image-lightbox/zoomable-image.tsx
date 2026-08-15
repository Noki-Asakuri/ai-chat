"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import type { ImageLoadState } from "./types";

const DEFAULT_SCALE = 1;
const DEFAULT_MAX_SCALE = 8;
const ZOOM_STEP = 1.5;

type TransformState = {
  scale: number;
  x: number;
  y: number;
};

type PointerPosition = {
  x: number;
  y: number;
};

type PanGesture = {
  type: "pan";
  pointerId: number;
  startPointer: PointerPosition;
  startTransform: TransformState;
};

type PinchGesture = {
  type: "pinch";
  startCenter: PointerPosition;
  startDistance: number;
  startTransform: TransformState;
};

type Gesture = PanGesture | PinchGesture;

export type ZoomableImageHandle = {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type ZoomableImageProps = {
  ref?: React.Ref<ZoomableImageHandle>;
  src: string;
  alt: string;
  className?: string;
  maxScale?: number;
  onNaturalSize?: (size: { width: number; height: number }) => void;
  onLoadStateChange?: (state: ImageLoadState) => void;
};

export function ZoomableImage(props: ZoomableImageProps) {
  const { ref, src, alt, className, maxScale = DEFAULT_MAX_SCALE, onNaturalSize, onLoadStateChange } = props;
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const transformRef = React.useRef<TransformState>({ scale: DEFAULT_SCALE, x: 0, y: 0 });
  const pointersRef = React.useRef(new Map<number, PointerPosition>());
  const gestureRef = React.useRef<Gesture | null>(null);

  function clampPosition(nextTransform: TransformState): TransformState {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport || nextTransform.scale <= DEFAULT_SCALE) {
      return { scale: DEFAULT_SCALE, x: 0, y: 0 };
    }

    const maxOffsetX = Math.max(0, (image.clientWidth * nextTransform.scale - viewport.clientWidth) / 2);
    const maxOffsetY = Math.max(0, (image.clientHeight * nextTransform.scale - viewport.clientHeight) / 2);

    return {
      scale: nextTransform.scale,
      x: clamp(nextTransform.x, -maxOffsetX, maxOffsetX),
      y: clamp(nextTransform.y, -maxOffsetY, maxOffsetY),
    };
  }

  function applyTransform(): void {
    const image = imageRef.current;
    if (!image) return;

    const { scale, x, y } = transformRef.current;
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    image.style.cursor = scale > DEFAULT_SCALE ? "grab" : "zoom-in";
  }

  function scheduleTransform(): void {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      applyTransform();
    });
  }

  function setTransform(nextTransform: TransformState): void {
    transformRef.current = clampPosition(nextTransform);
    scheduleTransform();
  }

  function reset(): void {
    transformRef.current = { scale: DEFAULT_SCALE, x: 0, y: 0 };
    gestureRef.current = null;
    applyTransform();
  }

  function zoomAt(nextScale: number, origin: PointerPosition): void {
    const current = transformRef.current;
    const scale = clamp(nextScale, DEFAULT_SCALE, maxScale);
    const ratio = scale / current.scale;

    setTransform({
      scale,
      x: origin.x - (origin.x - current.x) * ratio,
      y: origin.y - (origin.y - current.y) * ratio,
    });
  }

  function zoomFromCenter(factor: number): void {
    zoomAt(transformRef.current.scale * factor, { x: 0, y: 0 });
  }

  React.useImperativeHandle(ref, () => ({
    reset,
    zoomIn: () => zoomFromCenter(ZOOM_STEP),
    zoomOut: () => zoomFromCenter(1 / ZOOM_STEP),
  }));

  React.useEffect(() => {
    reset();
  }, [src]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      transformRef.current = clampPosition(transformRef.current);
      scheduleTransform();
    });
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheelViewport = viewport;

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      const origin = getViewportPosition(event.clientX, event.clientY, wheelViewport);
      zoomAt(transformRef.current.scale * Math.exp(-event.deltaY * 0.001), origin);
    }

    wheelViewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => wheelViewport.removeEventListener("wheel", handleWheel);
  });

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.type === "pan") {
      const pointer = pointersRef.current.get(gesture.pointerId);
      if (!pointer) return;

      setTransform({
        scale: gesture.startTransform.scale,
        x: gesture.startTransform.x + pointer.x - gesture.startPointer.x,
        y: gesture.startTransform.y + pointer.y - gesture.startPointer.y,
      });
      return;
    }

    const pair = getPointerPair();
    if (!pair) return;

    const viewport = viewportRef.current;
    if (!viewport) return;
    const pairCenter = midpoint(pair[0], pair[1]);
    const center = getViewportPosition(pairCenter.x, pairCenter.y, viewport);
    const scale = clamp(
      gesture.startTransform.scale * (distance(pair[0], pair[1]) / gesture.startDistance),
      DEFAULT_SCALE,
      maxScale,
    );
    const ratio = scale / gesture.startTransform.scale;

    setTransform({
      scale,
      x: center.x - (gesture.startCenter.x - gesture.startTransform.x) * ratio,
      y: center.y - (gesture.startCenter.y - gesture.startTransform.y) * ratio,
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>): void {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    startGesture();
    applyTransform();
  }

  function startGesture(): void {
    const pair = getPointerPair();
    if (pair) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const pairCenter = midpoint(pair[0], pair[1]);
      gestureRef.current = {
        type: "pinch",
        startCenter: getViewportPosition(pairCenter.x, pairCenter.y, viewport),
        startDistance: Math.max(distance(pair[0], pair[1]), 1),
        startTransform: { ...transformRef.current },
      };
      return;
    }

    const pointer = pointersRef.current.entries().next().value;
    gestureRef.current =
      pointer && transformRef.current.scale > DEFAULT_SCALE
        ? {
            type: "pan",
            pointerId: pointer[0],
            startPointer: pointer[1],
            startTransform: { ...transformRef.current },
          }
        : null;
  }

  function getPointerPair(): [PointerPosition, PointerPosition] | null {
    const pointers = [...pointersRef.current.values()];
    return pointers.length >= 2 ? [pointers[0]!, pointers[1]!] : null;
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (transformRef.current.scale > DEFAULT_SCALE) {
      reset();
      return;
    }

    zoomAt(2, getViewportPosition(event.clientX, event.clientY, event.currentTarget));
  }

  function handleLoad(event: React.SyntheticEvent<HTMLImageElement>): void {
    onLoadStateChange?.("loaded");
    const image = event.currentTarget;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      onNaturalSize?.({ width: image.naturalWidth, height: image.naturalHeight });
    }
  }

  return (
    <div
      ref={viewportRef}
      className="relative flex size-full min-h-0 touch-none items-center justify-center overflow-hidden rounded-md"
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        onLoad={handleLoad}
        onError={() => onLoadStateChange?.("error")}
        className={cn("block rounded-md object-contain will-change-transform select-none", className)}
      />
    </div>
  );
}

function getViewportPosition(clientX: number, clientY: number, viewport: HTMLDivElement): PointerPosition {
  const rect = viewport.getBoundingClientRect();
  return {
    x: clientX - rect.left - rect.width / 2,
    y: clientY - rect.top - rect.height / 2,
  };
}

function midpoint(first: PointerPosition, second: PointerPosition): PointerPosition {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first: PointerPosition, second: PointerPosition): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
