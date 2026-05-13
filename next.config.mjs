/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /** Evita `Cannot find module './vendor-chunks/sonner.js'` en dev (SSR + worker de rutas). */
    serverComponentsExternalPackages: ['sonner'],
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/reclutamiento/dashboard', destination: '/reclutamiento', permanent: true },
    ];
  },
  webpack: (config, { dev }) => {
    // No reasignar `config.output` entero: en algunos entornos rompe los paths de chunks (`/_next/...`) → 404 en main.js/webpack.
    if (dev && config.output) {
      config.output.chunkLoadTimeout = 300000;
    }
    // En dev, caché filesystem de webpack puede dejar referencias a chunks ya borrados (p. ej. Cannot find module './1682.js').
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
