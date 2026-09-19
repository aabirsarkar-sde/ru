"use client";
import { useRef, useState } from "react";
import { Logo } from "@/components/brand";
import { Spinner } from "@/components/ui";
import type { Photo } from "@/engine/responses";
import { compressImage, formatBytes } from "@/lib/image";

export function PhoneUpload({ token }: { token: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (files: FileList) => {
    setError(null);
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const photo = await compressImage(f, f.name || "phone-photo.jpg", "phone");
        const r = await fetch(`/api/handoff/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo }),
        });
        if (!r.ok) throw new Error();
        setSent((s) => [...s, photo]);
      }
    } catch {
      setError("That didn't send. Check you're on the same Wi-Fi as the test computer and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-6" data-accent="red">
      <Logo href={null} />
      <div>
        <h1 className="font-serif text-4xl leading-tight">Send a photo to your test</h1>
        <p className="mt-2 text-ink-soft">
          Lay your paper flat in good light, hold the phone directly above it, and take the photo. It will appear on your test screen within a few seconds.
        </p>
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex h-16 items-center justify-center gap-3 bg-red text-lg font-semibold text-white shadow-lg active:translate-y-px disabled:opacity-60 curve-br-sm"
      >
        {busy ? <Spinner /> : <span aria-hidden>📷</span>}
        {busy ? "Sending…" : sent.length ? "Take another photo" : "Take a photo"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) send(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="rounded-lg bg-cream p-3 text-sm font-medium text-red">{error}</p>}
      {sent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-mute">Sent to your test</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {sent.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt="Sent photo" className="aspect-[4/3] w-full object-cover" />
                <p className="px-2 py-1 text-xs text-ok">✓ Sent · {formatBytes(p.bytes)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft">You can put your phone away now and carry on at the computer.</p>
        </section>
      )}
    </main>
  );
}
