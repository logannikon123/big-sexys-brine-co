import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from writing its own notes into agents.md and CLAUDE.md.
  agentRules: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
