/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router route handlers stream the request body and are not subject to the
  // old Pages-API 4MB limit, so large screenshot batches to /api/ingest work
  // without extra configuration.

  // Keep these out of the server bundle: pg does dynamic/native requires and
  // the Anthropic SDK is a Node package — bundling them breaks the build's
  // page-data collection. Next loads them from node_modules at runtime instead.
  serverExternalPackages: ["pg", "@anthropic-ai/sdk"],
};

export default nextConfig;
