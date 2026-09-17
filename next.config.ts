import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // theres a stray package-lock.json in the home dir, without this turbopack walks up
  // past the repo and infers the wrong workspace root
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
