import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MenChat",
    short_name: "MenChat",
    description: "Seu espaço privado de conversa.",
    lang: "pt-BR",
    start_url: "/conta/chat",
    scope: "/",
    display: "standalone",
    background_color: "#0e1714",
    theme_color: "#196b50",
    icons: [
      {
        src: "/app/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
