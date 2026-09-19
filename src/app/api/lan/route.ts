import os from "node:os";
import { NextResponse } from "next/server";

// Returns an origin a phone on the same network can reach, for the QR code.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  const port = host.split(":")[1] ?? (url.protocol === "https:" ? "443" : "80");
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host);
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find((n) => n && n.family === "IPv4" && !n.internal)?.address;
  const origin = isLocal && ip ? `${url.protocol}//${ip}:${port}` : `${url.protocol}//${host}`;
  return NextResponse.json({ origin, lan: isLocal && !!ip });
}
