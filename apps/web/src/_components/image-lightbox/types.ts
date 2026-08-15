import type { Dialog } from "@base-ui/react/dialog";
import type * as React from "react";

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

export type ImageLightboxProviderProps = {
  images: LightboxImage[];
  children: React.ReactNode;
};

export type ImageLightboxTriggerProps = Omit<
  React.ComponentProps<typeof Dialog.Trigger>,
  "handle" | "payload"
> & {
  index: number;
};

export type ImageLoadState = "loading" | "loaded" | "error";
export type NavigationDirection = -1 | 0 | 1;
