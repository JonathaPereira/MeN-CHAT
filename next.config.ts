import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
// Autoriza apenas os endereços desta máquina; não libera origens arbitrárias.
const localAddresses = Object.values(networkInterfaces())
  .flatMap((interfaces) => interfaces ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

const nextConfig: NextConfig = {
  async redirects() {
    return ["", ".sha256"].map((suffix) => ({
      source: `/downloads/menchat-1.0.0.apk${suffix}`,
      destination: `/downloads/menchat-1.0.1.apk${suffix}`,
      permanent: false,
    }));
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
  // Evita usar o lockfile de uma pasta ZIP/clone acima deste projeto.
  turbopack: { root: projectRoot },
  // O Next dev também verifica a origem de scripts e do WebSocket de HMR.
  allowedDevOrigins: [...new Set(["127.0.0.1", ...localAddresses])],
};

export default nextConfig;
