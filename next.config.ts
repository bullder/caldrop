import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Route handlers run on the Node runtime (filesystem + crypto + zip streaming).
  output: "standalone",
  // The download/preview routes read seeded data via fs at runtime, which file
  // tracing can't infer from a static import — bundle it explicitly so the
  // serverless functions (Vercel) ship with the seeded data. Download streams
  // the prerendered hashed CSVs under data/lists/; preview reads personal.csv.
  outputFileTracingIncludes: {
    "/data/download": ["./data/lists/**", "./data/personal.csv"],
    "/sandbox/data/download": ["./data/lists/**", "./data/personal.csv"],
    "/preview": ["./data/personal.csv"],
  },
};

export default nextConfig;
