import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // zod ships an ESM `import` entry and a CJS `require` entry. Next's server
    // bundler picks the ESM one at build time but emits a CommonJS require, so
    // anything reached through `zod-to-json-schema` (via @ai-sdk/ui-utils)
    // fails to resolve at runtime. Alias the subpath to its CJS build.
    serverComponentsExternalPackages: ["zod", "zod-to-json-schema"],
  },

  webpack: (config) => {
    // Pin both the bare and subpath specifiers to the CJS entry.
    config.resolve.alias = {
      ...config.resolve.alias,
      "zod/v3": require.resolve("zod/v3"),
    };
    return config;
  },
};

export default nextConfig;
