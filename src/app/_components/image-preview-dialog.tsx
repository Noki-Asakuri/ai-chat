import { useEffect, useState } from "react";
import { Dialog } from "@base-ui-components/react/dialog";

import { format } from "@/lib/utils";

type ImagePreviewDialogProps = Omit<
  React.ComponentPropsWithoutRef<typeof Dialog.Trigger>,
  "children"
> & {
  file?: File | null;
  image: { src?: string; alt: string; name: string; size?: number };
  children: ((objectUrl: string | null) => React.ReactNode) | React.ReactNode;
};

export function ImagePreviewDialog({
  children,
  className,
  image,
  file,
  ...props
}: ImagePreviewDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      return setObjectUrl(null);
    }

    const objectUrlString = URL.createObjectURL(file);
    setObjectUrl(objectUrlString);

    return () => {
      URL.revokeObjectURL(objectUrlString);
    };
  }, [file]);

  if (!image.src && !objectUrl) return null;

  return (
    <Dialog.Root>
      <Dialog.Trigger className={className} {...props}>
        {typeof children === "function" ? children(objectUrl) : image.src ? children : null}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />

        <Dialog.Popup className="pointer-events-none fixed top-1/2 left-1/2 z-50 -mt-8 flex w-max max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 transition-all duration-150 outline-none data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
          <img
            src={objectUrl ?? image.src}
            alt={image.alt}
            className="pointer-events-auto max-h-[80vh] rounded-lg object-center"
          />

          <div className="pointer-events-auto flex flex-col items-center justify-center gap-1 text-sm">
            <span>Name: {image.name}</span>
            {image.size && <span>Size: {format.size(image.size)}</span>}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
