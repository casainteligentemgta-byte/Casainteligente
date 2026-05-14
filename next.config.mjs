/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Paquetes que se ejecutan en el servidor Node.js (fuera del bundle Edge/SSR) ───
  // serverComponentsExternalPackages fue renombrado en Next 15; mantenemos ambos para compatibilidad.
  serverExternalPackages: [
    '@react-pdf/renderer', // genera PDFs en servidor; muy pesado para bundlear
    'canvas',              // dependencia nativa de react-pdf
    'sonner',              // evita "Cannot find module ./vendor-chunks/sonner.js" en dev
  ],

  reactStrictMode: true,

  // ─── Compresión gzip/brotli en producción ───────────────────────────────────────
  compress: true,

  // ─── Imágenes optimizadas ───────────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    // Tiempo de caché de imágenes optimizadas (1 semana)
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // ─── Headers de seguridad y caché ───────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Caché agresivo para assets estáticos de Next.js
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // ─── Redirecciones ──────────────────────────────────────────────────────────────
  async redirects() {
    return [
      { source: '/reclutamiento/dashboard', destination: '/reclutamiento', permanent: true },
    ];
  },

  // ─── Webpack (solo ajustes de desarrollo) ───────────────────────────────────────
  webpack: (config, { dev, isServer }) => {
    // En dev: aumentar timeout de carga de chunks y desactivar caché filesystem
    // (evita "Cannot find module './1682.js'" tras hot-reload agresivo)
    if (dev) {
      if (config.output) config.output.chunkLoadTimeout = 300_000;
      config.cache = false;
    }

    // Excluir canvas del bundle del cliente (solo lo necesita el servidor para react-pdf)
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        canvas: false,
        fs: false,
        path: false,
        stream: false,
      };
    }

    return config;
  },

  // ─── Logging de fetch en producción (desactivado para reducir ruido) ─────────────
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
