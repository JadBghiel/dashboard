import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the docker image ships .next/standalone: next traces what the server actually imports, so the
  output: "standalone",

  // theres a stray package-lock.json in the home dir, without this turbopack walks up
  // past the repo and infers the wrong workspace root
  turbopack: {
    root: import.meta.dirname,
  },

  // company and coin logos come straight from finnhub's and coingecko's cdn, every other host stays
  // blocked
  images: {
    remotePatterns: [
      new URL("https://static2.finnhub.io/file/publicdatany/finnhubimage/**"),
      new URL("https://coin-images.coingecko.com/coins/images/**"),
    ],
  },
};

export default nextConfig;
