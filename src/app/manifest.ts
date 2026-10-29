import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Enterprise HRMS",
    short_name: "HRMS",
    description: "Human resource management for the full employee lifecycle.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#f3f4f6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
