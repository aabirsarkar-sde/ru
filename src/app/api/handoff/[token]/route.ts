import { NextResponse } from "next/server";
import { listPhotos, putPhoto, takePhotos } from "@/lib/handoff-store";
import type { Photo } from "@/engine/responses";

const MAX_BYTES = 3 * 1024 * 1024;
const valid = (token: string) => /^[\w-]{6,120}$/.test(token);

export async function GET(_req: Request, ctx: RouteContext<"/api/handoff/[token]">) {
  const { token } = await ctx.params;
  if (!valid(token)) return NextResponse.json({ error: "bad token" }, { status: 400 });
  return NextResponse.json({ photos: listPhotos(token) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, ctx: RouteContext<"/api/handoff/[token]">) {
  const { token } = await ctx.params;
  if (!valid(token)) return NextResponse.json({ error: "bad token" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { photo?: Photo } | null;
  const p = body?.photo;
  if (!p || typeof p.dataUrl !== "string" || !p.dataUrl.startsWith("data:image/"))
    return NextResponse.json({ error: "no photo" }, { status: 400 });
  if (p.dataUrl.length > MAX_BYTES * 1.37) return NextResponse.json({ error: "too large" }, { status: 413 });
  putPhoto(token, { ...p, via: "phone", at: Date.now() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/handoff/[token]">) {
  const { token } = await ctx.params;
  const ids = new URL(req.url).searchParams.getAll("id");
  takePhotos(token, ids);
  return NextResponse.json({ ok: true });
}
