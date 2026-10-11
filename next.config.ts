import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the docker image ships .next/standalone: next traces what the server actually imports, so the
  output: "standalone",

  // theres a stray package-lock.json in the home dir, without this turbopack walks up
  // past the repo and infers the wrong workspace root
  turbopack: {
    root: import.meta.dirname,
  },

  // company and coin logos, fetched by our server from finnhub's and coingecko's cdn and served from
  // our domain. every other host stays blocked. a logo doesnt change, kept 30 days so the optimizer
  // rarely runs
  images: {
    minimumCacheTTL: 2_592_000,
    remotePatterns: [
      new URL("https://static2.finnhub.io/file/publicdatany/finnhubimage/**"),
      new URL("https://coin-images.coingecko.com/coins/images/**"),
    ],
  },
};

export default nextConfig;
