import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the docker image ships .next/standalone: next traces what the server actually imports, so the
  // runner needs no npm install and no full node_modules
  output: "standalone",

  // theres a stray package-lock.json in the home dir, without this turbopack walks up
  // past the repo and infers the wrong workspace root
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
