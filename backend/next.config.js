/** @type {import('next').NextConfig} */
const nextConfig = {
  // Screenshots arrive as sizeable base64 payloads inside JSON batches.
  // Raise the body size the API route will accept.
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
