import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // The ticket renderer loads Geist weights from disk at request time so the
  // server PNG matches the browser preview (bold actually renders bold).
  outputFileTracingIncludes: {
    "/api/tickets/render": ["./public/fonts/tickets/*.ttf"],
  },
};

export default nextConfig;
