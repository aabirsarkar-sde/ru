import { describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/handoff/[token]/route";
import { listPhotos } from "@/lib/handoff-store";

// The token is the only access control on the handoff store, so DELETE must
// validate it exactly like GET and POST do.
const ctx = (token: string) => ({ params: Promise.resolve({ token }) }) as never;
const req = (url: string) => new Request(url);

describe("handoff DELETE token validation", () => {
  it("rejects an invalid token with 400 and deletes nothing", async () => {
    const token = "validtoken1";
    const photo = { id: "photo-1", dataUrl: "data:image/png;base64,iVBORw0KGgo=", via: "phone" as const, at: Date.now() };
    await POST(new Request(`http://x/api/handoff/${token}`, { method: "POST", body: JSON.stringify({ photo }) }), ctx(token));
    expect(listPhotos(token)).toHaveLength(1);

    // A 1-char token fails the /^[\w-]{6,120}$/ regex used by GET and POST.
    const res = await DELETE(req("http://x/api/handoff/x?id=photo-1"), ctx("x"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad token" });

    // The photo under the real token must be untouched.
    expect(listPhotos(token)).toHaveLength(1);
  });

  it("still consumes photos for a valid token", async () => {
    const token = "validtoken2";
    const photo = { id: "photo-2", dataUrl: "data:image/png;base64,iVBORw0KGgo=", via: "phone" as const, at: Date.now() };
    await POST(new Request(`http://x/api/handoff/${token}`, { method: "POST", body: JSON.stringify({ photo }) }), ctx(token));

    const res = await DELETE(req(`http://x/api/handoff/${token}?id=photo-2`), ctx(token));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(listPhotos(token)).toHaveLength(0);

    const got = await GET(req(`http://x/api/handoff/${token}`), ctx(token));
    expect((await got.json()).photos).toHaveLength(0);
  });
});
