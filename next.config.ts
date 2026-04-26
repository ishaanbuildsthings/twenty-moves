import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cubing.js loads its scramble worker via `import.meta.resolve`/`new URL(..., import.meta.url)`,
  // which break when the package is bundled for serverless. Externalize so it's required from
  // node_modules at runtime — otherwise the worker silently fails to load and scramble
  // generation hangs forever in production.
  serverExternalPackages: ["cubing"],
};

export default nextConfig;
