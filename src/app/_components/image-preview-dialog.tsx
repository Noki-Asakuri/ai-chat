import { Dialog } from "@base-ui-components/react/dialog";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ImagesIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { ButtonWithTip } from "./ui/button";

import { format } from "@/lib/utils";

function isClipboardImageWriteSupported(): boolean {
  const hasSecure = typeof window !== "undefined" && window.isSecureContext;
  const hasWrite = typeof navigator !== "undefined" && !!navigator.clipboard?.write;
  const hasItem = typeof window.ClipboardItem !== "undefined";

  return hasSecure && hasWrite && hasItem;
}

function getExtFromMime(type: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return map[type] ?? "";
}

function getNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const base = pathname.split("/").pop() || "";
    return decodeURIComponent(base);
  } catch {
    return "";
  }
}

function getExtFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i > -1 ? name.slice(i + 1).toLowerCase() : "";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  // filename*=UTF-8''..., or filename="..."
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const simple = /filename\s*=\s*"([^"]+)"/i.exec(header) || /filename\s*=\s*([^;]+)/i.exec(header);
  return simple?.[1]?.trim() ?? null;
}

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
    if (!file) return setObjectUrl(null);

    const objectUrlString = URL.createObjectURL(file);
    setObjectUrl(objectUrlString);

    return () => {
      URL.revokeObjectURL(objectUrlString);
    };
  }, [file]);

  if (!image.src && !objectUrl) return null;

  function openInNewTab() {
    if (!image.src) return;

    const url = image.src.replace(
      "https://ik.imagekit.io/gmethsnvl/ai-chat/",
      "https://files.chat.asakuri.me/",
    );

    window.open(url, "_blank", "noopener noreferrer");
  }

  async function copyImage() {
    if (!image.src) return;
    if (!isClipboardImageWriteSupported()) {
      return toast.error("Copying image is not supported in this browser.", {
        position: "top-center",
        duration: 3000,
      });
    }

    const url = image.src.replace(
      "https://ik.imagekit.io/gmethsnvl/ai-chat/",
      "https://files.chat.asakuri.me/",
    );

    const htmlImage = new Image();
    htmlImage.crossOrigin = "anonymous"; // requires proper CORS headers from the server
    htmlImage.decoding = "async";
    htmlImage.src = url;

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

  async function copyLink() {
    if (!image.src) return;

    const url = image.src.replace(
      "https://ik.imagekit.io/gmethsnvl/ai-chat/",
      "https://files.chat.asakuri.me/",
    );

    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard", { position: "top-center", duration: 3000 });
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger className={className} {...props}>
        {typeof children === "function" ? children(objectUrl) : image.src ? children : null}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />

        <Dialog.Popup
          data-slot="image-preview-popup"
          className="pointer-events-none fixed top-0 z-50 flex h-full w-full flex-col items-center justify-center gap-2 transition-[transform,opacity,scale] duration-150 outline-none data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0"
        >
          <div className="absolute top-4 right-4 flex h-10 items-center gap-2">
            <div
              data-hidden={!image.src}
              className="bg-muted/80 flex gap-2 rounded-md border p-1 data-[hidden=true]:hidden"
            >
              <DownloadImageButton image={image} />

              <ButtonWithTip
                title="Open in New Tab"
                variant="ghost"
                className="pointer-events-auto size-8"
                onMouseDown={openInNewTab}
              >
                <ExternalLinkIcon />
                <span className="sr-only">Open in New Tab</span>
              </ButtonWithTip>

              <ButtonWithTip
                title="Copy Image"
                variant="ghost"
                className="pointer-events-auto size-8"
                onMouseDown={copyImage}
              >
                <ImagesIcon />
                <span className="sr-only">Copy Image</span>
              </ButtonWithTip>

              <ButtonWithTip
                title="Copy Link"
                variant="ghost"
                className="pointer-events-auto size-8"
                onMouseDown={copyLink}
              >
                <CopyIcon />
                <span className="sr-only">Copy Link</span>
              </ButtonWithTip>
            </div>

            <div className="bg-muted/80 rounded-md border p-1">
              <Dialog.Close
                render={<ButtonWithTip variant={"ghost"} />}
                title="Close"
                className="pointer-events-auto size-8"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6">
            <img
              src={objectUrl ?? image.src}
              alt={image.alt}
              className="pointer-events-auto max-h-[80vh] rounded-lg object-center"
            />

            <div className="pointer-events-auto flex flex-col items-center justify-center gap-1 text-sm">
              <span>Name: {image.name}</span>
              {image.size && <span>Size: {format.size(image.size)}</span>}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DownloadImageButton({ image }: { image: ImagePreviewDialogProps["image"] }) {
  const [isPending, startTransition] = useTransition();

  function downloadImage() {
    if (!image?.src) return;

    const url = image.src.replace(
      "https://ik.imagekit.io/gmethsnvl/ai-chat/",
      "https://files.chat.asakuri.me/",
    );

    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(url, { mode: "cors", credentials: "omit" });
      } catch {
        toast.error("Failed to fetch image for download (CORS).", { position: "top-center" });
        return;
      }

      if (!response.ok) {
        toast.error("Failed to fetch image.", { position: "top-center" });
        return;
      }

      const blob = await response.blob();

      // Decide filename: Content-Disposition > image.name > URL last segment > "image"
      const cdName = parseContentDispositionFilename(response.headers.get("content-disposition"));
      const urlName = getNameFromUrl(url);

      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      const candidate = cdName || image?.name || urlName || "image";

      let fileName = sanitizeFilename(candidate);
      const haveExt = !!getExtFromName(fileName);

      if (!haveExt) {
        const fromType = getExtFromMime(blob.type);
        if (fromType) fileName = `${fileName}.${fromType}`;
      }

      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Ensure the download has started before revoking
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      toast.success("Download started", { position: "top-center" });
    });
  }

  return (
    <ButtonWithTip
      title="Download"
      variant="ghost"
      className="pointer-events-auto size-8"
      onMouseDown={downloadImage}
      disabled={isPending}
    >
      {isPending ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
      <span className="sr-only">Download</span>
    </ButtonWithTip>
  );
}
