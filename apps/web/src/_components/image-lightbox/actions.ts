import { toast } from "@/components/ui/toast";
import { toRawFileUrl } from "@/lib/assets/urls";

import type { LightboxImage } from "./types";

export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    toast.error("Copying URLs is not supported in this browser.", { timeout: 3000 });
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success("URL copied to clipboard", { timeout: 3000 });
  } catch {
    toast.error("Unable to copy the URL. Check this site’s clipboard permission.", { timeout: 3000 });
  }
}

export function openInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function resolvePrimaryActionUrl(image: LightboxImage): string {
  return image.downloadSrc ?? toRawFileUrl(image.src);
}

export async function copyImage(image: LightboxImage): Promise<void> {
  if (!isClipboardImageWriteSupported()) {
    toast.error("Copying images is not supported in this browser.", { timeout: 3000 });
    return;
  }

  try {
    const htmlImage = await loadImage(image.clipboardSrc ?? toRawFileUrl(image.src));
    const canvas = document.createElement("canvas");
    canvas.width = htmlImage.naturalWidth || htmlImage.width;
    canvas.height = htmlImage.naturalHeight || htmlImage.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create drawing context");

    context.drawImage(htmlImage, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) throw new Error("Unable to create image blob");

    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    toast.success("Image copied to clipboard", { timeout: 3000 });
  } catch {
    toast.error("Unable to copy the image. Check clipboard permission and image access.", {
      timeout: 3000,
    });
  }
}

export async function downloadImage(image: LightboxImage): Promise<void> {
  const name = image.downloadName ?? image.name ?? "image";
  const downloadUrl = resolvePrimaryActionUrl(image);

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

    const objectUrl = URL.createObjectURL(await response.blob());
    triggerDownload(objectUrl, name);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    toast.success("Image downloaded", { timeout: 3000 });
  } catch {
    triggerDownload(downloadUrl, name);
  }
}

function isClipboardImageWriteSupported(): boolean {
  return (
    window.isSecureContext && !!navigator.clipboard?.write && typeof window.ClipboardItem !== "undefined"
  );
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";

  if (typeof image.decode === "function") {
    image.src = url;
    await image.decode();
    return image;
  }

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
  return image;
}

function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
}
