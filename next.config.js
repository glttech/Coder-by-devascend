/**
 * @type {import('next').NextConfig}
 *
 * Minimal Next.js configuration for the ai‑dev‑orchestrator.  React strict
 * mode is enabled for additional runtime checks.  The experimental app
 * directory is turned on so that routes live under `src/app`.  See
 * https://nextjs.org/docs/app/building-your-application/routing for more.
 */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;