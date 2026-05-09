/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // No reasignar `config.output` entero: en algunos entornos rompe los paths de chunks (`/_next/...`) → 404 en main.js/webpack.
    if (dev && config.output) {
      config.output.chunkLoadTimeout = 300000;
    }
    return config;
  },
};

export default nextConfig;
