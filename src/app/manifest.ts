import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AiDHD",
    short_name: "AiDHD",
    description:
      "Group nights & trips — invite friends, chat with AiDHD, book with Prava.",
    start_url: "/groups",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#08090b",
    theme_color: "#08090b",
    categories: ["travel", "social", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/groups",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
