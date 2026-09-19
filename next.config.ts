import os from "node:os";
import type { NextConfig } from "next";

// The phone-upload handoff opens this dev server from a phone on the same
// Wi-Fi, so allow this machine's LAN addresses as dev origins.
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
  turbopack: { root: import.meta.dirname },
  devIndicators: false,
};

export default nextConfig;
