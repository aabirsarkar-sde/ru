// Client-side image compression before upload (PRD §10): phone photos are
// often 4–8 MB; on a 2 Mbps connection that's 30 s each. We downscale to at
// most 1600 px on the long edge and re-encode as JPEG (~150–400 KB).
import type { Photo } from "@/engine/responses";

export async function compressImage(file: File | Blob, name: string, via: Photo["via"], maxEdge = 1600): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() =>
    createImageBitmap(file),
  );
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return {
    id: `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    dataUrl,
    width: w,
    height: h,
    bytes: Math.round((dataUrl.length - 23) * 0.75),
    via,
    at: Date.now(),
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
