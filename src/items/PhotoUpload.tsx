"use client";
import QRCode from "qrcode";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import { hashString } from "@/engine/prng";
import type { Photo } from "@/engine/responses";
import { compressImage, formatBytes } from "@/lib/image";
import type { ItemProps } from "./types";

export function PhotoUpload({ item, response, onChange, ctx }: ItemProps<"photo_upload">) {
  return (
    <PhotoPicker
      photos={response?.photos ?? []}
      min={item.min_files}
      max={item.max_files}
      phone={item.phone_handoff}
      handoffKey={`${ctx.candidateId}-${item.id}`}
      onChange={(photos) => onChange({ type: "photo_upload", photos })}
    />
  );
}

/**
 * Upload from this device, or scan a QR code and upload from a phone. Photos
 * are compressed in the browser before they go anywhere.
 */
export function PhotoPicker({
  photos,
  min,
  max,
  onChange,
  handoffKey,
  phone = true,
  hint,
}: {
  photos: Photo[];
  min: number;
  max: number;
  onChange: (p: Photo[]) => void;
  handoffKey: string;
  phone?: boolean;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  useLayoutEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  const room = max - photos.length;

  const add = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return setError("That doesn't look like an image. Try a JPG or PNG photo.");
    const take = list.slice(0, Math.max(0, max - photosRef.current.length));
    if (take.length < list.length) setError(`Only ${max} photo${max > 1 ? "s" : ""} allowed here.`);
    setBusy((b) => b + take.length);
    for (const f of take) {
      try {
        const p = await compressImage(f, f.name, "device");
        onChange([...photosRef.current, p]);
        photosRef.current = [...photosRef.current, p];
      } catch {
        setError(`Couldn't read ${f.name}. Try taking the photo again.`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            add(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors curve-br ${
            drag ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line-strong bg-white"
          }`}
        >
          <span aria-hidden className="text-3xl">🖼</span>
          <p className="font-semibold">Drop photos here, or</p>
          <button
            type="button"
            disabled={room <= 0}
            onClick={() => input.current?.click()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            Choose from this computer
          </button>
          <p className="text-xs text-ink-mute">
            {min === max ? `${max} photo` : `${min}–${max} photos`} · JPG or PNG · we shrink large photos automatically
          </p>
          {hint && <p className="text-xs text-ink-soft">{hint}</p>}
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            multiple={max > 1}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red">{error}</p>}
        {(photos.length > 0 || busy > 0) && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="group relative animate-rise overflow-hidden rounded-lg bg-white ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt={`Uploaded photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-ink-soft">
                  <span>
                    {p.via === "phone" ? "📱 from phone" : "💻 this computer"} · {formatBytes(p.bytes)}
                  </span>
                  <button type="button" onClick={() => onChange(photos.filter((x) => x.id !== p.id))} className="font-semibold text-red hover:underline" aria-label={`Remove photo ${i + 1}`}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
            {Array.from({ length: busy }).map((_, i) => (
              <li key={`b${i}`} className="grid aspect-[4/3] place-items-center rounded-lg bg-cream text-sm text-ink-soft">
                <span className="flex items-center gap-2">
                  <Spinner /> Compressing…
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
          {photos.length}/{max} uploaded{photos.length < min ? ` — at least ${min} needed` : " ✓"}
        </p>
      </div>
      {phone && room > 0 && <PhoneHandoff handoffKey={handoffKey} onPhotos={(ps) => {
        const fresh = ps.filter((p) => !photosRef.current.some((x) => x.id === p.id)).slice(0, max - photosRef.current.length);
        if (fresh.length) onChange([...photosRef.current, ...fresh]);
      }} />}
    </div>
  );
}

function PhoneHandoff({ handoffKey, onPhotos }: { handoffKey: string; onPhotos: (p: Photo[]) => void }) {
  const token = `h${hashString(handoffKey).toString(36)}${hashString(handoffKey + ":salt").toString(36)}`;
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");
  const [received, setReceived] = useState(0);
  const onPhotosRef = useRef(onPhotos);
  useLayoutEffect(() => {
    onPhotosRef.current = onPhotos;
  }, [onPhotos]);

  useEffect(() => {
    let alive = true;
    fetch("/api/lan")
      .then((r) => r.json())
      .then(async ({ origin }: { origin: string }) => {
        const u = `${origin}/m/${token}`;
        const data = await QRCode.toDataURL(u, { margin: 1, width: 360, color: { dark: "#333A3D", light: "#FFFFFF" } });
        if (alive) {
          setUrl(u);
          setQr(data);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  // Poll for photos sent from the phone, then consume them from the queue.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/handoff/${token}`, { cache: "no-store" });
        const { photos } = (await r.json()) as { photos: Photo[] };
        if (photos.length) {
          onPhotosRef.current(photos);
          setReceived((n) => n + photos.length);
          await fetch(`/api/handoff/${token}?${photos.map((p) => `id=${encodeURIComponent(p.id)}`).join("&")}`, { method: "DELETE" });
        }
      } catch {
        /* offline — keep polling */
      }
    }, 2500);
    return () => clearInterval(id);
  }, [token]);

  return (
    <aside className="flex w-full flex-col items-center gap-3 bg-cream p-5 text-center lg:w-64 curve-br">
      <p className="text-sm font-semibold">Or use your phone</p>
      <div className="grid size-44 place-items-center rounded-xl bg-white p-2 ring-1 ring-line">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code to open the phone upload page" className="size-full" />
        ) : (
          <Spinner className="text-ink-mute" />
        )}
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        Scan with your phone camera, take the photo, and it appears here within a few seconds. Your phone must be on the same Wi-Fi.
      </p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="break-all text-[0.68rem] text-ink-mute underline">
          {url.replace(/^https?:\/\//, "")}
        </a>
      )}
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
        <span className="size-2 animate-pulse-soft rounded-full bg-ok" /> {received ? `${received} received from phone` : "Waiting for your phone…"}
      </p>
    </aside>
  );
}
