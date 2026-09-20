"use client";
import { useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import type { PortfolioFile } from "@/engine/responses";
import { compressImage, formatBytes } from "@/lib/image";
import type { ItemProps } from "./types";

/**
 * Optional portfolio: paste links and/or upload PDFs and images.
 * Pasting is deliberately allowed here — a link is meant to be pasted.
 * Nothing is required: many strong candidates will not have a portfolio, and
 * this must not quietly penalise them.
 */
export function Portfolio({ item, response, onChange }: ItemProps<"portfolio">) {
  const links = response?.links ?? [""];
  const files = response?.files ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<{ links: string[]; files: PortfolioFile[] }>) =>
    onChange({ type: "portfolio", links, files, ...patch });

  const looksLikeUrl = (v: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v.trim());

  const addFiles = async (list: FileList) => {
    setError(null);
    setBusy(true);
    const next = [...files];
    for (const f of Array.from(list).slice(0, item.max_files - files.length)) {
      try {
        if (f.size > item.max_file_mb * 1024 * 1024 && !f.type.startsWith("image/")) {
          setError(`${f.name} is larger than ${item.max_file_mb} MB. Try a link instead.`);
          continue;
        }
        if (f.type.startsWith("image/")) {
          const p = await compressImage(f, f.name, "device", 2000);
          next.push({ id: p.id, name: f.name, type: "image/jpeg", bytes: p.bytes, dataUrl: p.dataUrl, at: Date.now() });
        } else if (f.type === "application/pdf") {
          const dataUrl: string = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = rej;
            r.readAsDataURL(f);
          });
          next.push({ id: `f_${next.length}_${f.size}`, name: f.name, type: f.type, bytes: f.size, dataUrl, at: Date.now() });
        } else {
          setError(`${f.name} isn't a PDF or an image. Please upload a PDF, JPG or PNG — or paste a link.`);
        }
      } catch {
        setError(`Couldn't read ${f.name}.`);
      }
    }
    set({ files: next });
    setBusy(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-mute">Link to your work</h3>
        <ul className="mt-3 grid gap-2">
          {links.slice(0, item.max_links).map((l, i) => {
            const bad = l.trim().length > 0 && !looksLikeUrl(l);
            return (
              <li key={i}>
                <div className={`flex items-center gap-2 rounded-xl bg-white px-3 ring-1 focus-within:ring-2 ${bad ? "ring-red" : "ring-line-strong focus-within:ring-[var(--accent)]"}`}>
                  <span aria-hidden className="text-ink-mute">
                    🔗
                  </span>
                  <input
                    type="url"
                    inputMode="url"
                    value={l}
                    aria-label={`Portfolio link ${i + 1}`}
                    placeholder={item.link_placeholder}
                    onChange={(e) => set({ links: links.map((x, j) => (j === i ? e.target.value : x)) })}
                    className="h-12 flex-1 bg-transparent text-[0.95rem] outline-none"
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => set({ links: links.filter((_, j) => j !== i) })}
                      aria-label={`Remove link ${i + 1}`}
                      className="text-sm font-semibold text-red hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {bad && <p className="mt-1 text-sm text-red">That doesn&apos;t look like a web address.</p>}
              </li>
            );
          })}
        </ul>
        {links.length < item.max_links && (
          <button
            type="button"
            onClick={() => set({ links: [...links, ""] })}
            className="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-white"
          >
            + Add another link
          </button>
        )}
        {item.examples.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            For example: {item.examples.join(" · ")}. Please make sure the link is public, or shared with anyone who has it.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-mute">Or upload a file</h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`mt-3 flex flex-col items-center gap-2 border-2 border-dashed p-6 text-center transition-colors curve-br ${
            drag ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line-strong bg-white"
          }`}
        >
          <span aria-hidden className="text-3xl">
            📄
          </span>
          <p className="font-semibold">Drop a file here, or</p>
          <button
            type="button"
            disabled={busy || files.length >= item.max_files}
            onClick={() => input.current?.click()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Spinner /> : "Choose a PDF or image"}
          </button>
          <p className="text-xs text-ink-mute">
            Up to {item.max_files} files · PDF, JPG or PNG · {item.max_file_mb} MB each
          </p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            multiple={item.max_files > 1}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red">{error}</p>}
        {files.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-line">
                <span aria-hidden>{f.type === "application/pdf" ? "📄" : "🖼"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-ink-mute">{formatBytes(f.bytes)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => set({ files: files.filter((x) => x.id !== f.id) })}
                  className="text-sm font-semibold text-red hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-ink-soft lg:col-span-2">
        Not required, and not scored — it goes to your Stage 3 interviewers as something to talk about. Skip it if you
        don&apos;t have a portfolio; plenty of strong candidates won&apos;t.
      </p>
    </div>
  );
}
