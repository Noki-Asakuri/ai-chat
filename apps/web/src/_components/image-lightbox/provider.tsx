"use client";

import { Dialog } from "@base-ui/react/dialog";
import * as React from "react";

import { cn } from "@/lib/utils";

import { ImageLightboxDialog } from "./dialog";
import type { ImageLightboxProviderProps, ImageLightboxTriggerProps } from "./types";

type LightboxPayload = { index: number };
type LightboxHandle = ReturnType<typeof Dialog.createHandle<LightboxPayload>>;
type LightboxContextValue = {
  handle: LightboxHandle;
  hasImages: boolean;
};

const LightboxHandleContext = React.createContext<LightboxContextValue | null>(null);

export function ImageLightboxProvider(props: ImageLightboxProviderProps) {
  const { images, children } = props;
  const [handle] = React.useState(() => Dialog.createHandle<LightboxPayload>());
  const hasImages = images.length > 0;

  return (
    <LightboxHandleContext.Provider value={{ handle, hasImages }}>
      {children}

      <Dialog.Root key={hasImages ? "has-images" : "empty"} handle={handle}>
        {({ payload }) =>
          hasImages ? (
            <ImageLightboxDialog
              key={payload?.index ?? 0}
              images={images}
              initialIndex={payload?.index ?? 0}
            />
          ) : null
        }
      </Dialog.Root>
    </LightboxHandleContext.Provider>
  );
}

export function ImageLightboxTrigger(props: ImageLightboxTriggerProps) {
  const { index, children, className, ...triggerProps } = props;
  const context = React.use(LightboxHandleContext);

  if (!context) {
    throw new Error("ImageLightboxTrigger must be used within ImageLightboxProvider.");
  }

  return (
    <Dialog.Trigger
      {...triggerProps}
      handle={context.handle}
      payload={{ index }}
      disabled={triggerProps.disabled || !context.hasImages}
      className={cn(
        "inline-flex cursor-zoom-in bg-transparent p-0 outline-none select-none focus-visible:ring-2 focus-visible:ring-white/50",
        className,
      )}
    >
      {children}
    </Dialog.Trigger>
  );
}
