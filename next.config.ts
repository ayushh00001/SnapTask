import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kepckbozaeyvddgmhscd.supabase.co" },
    ],
  },
};

export default nextConfig;
