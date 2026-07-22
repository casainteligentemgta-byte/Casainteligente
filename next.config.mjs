/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,

  // Next 14: paquetes nativos solo en Node (no en el bundle del cliente)
  experimental: {
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      'canvas',
      'mdb-reader',
      'browserify-aes',
      'create-hash',
      'fast-xml-parser',
      'pako',
    ],
  },

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
      { source: '/reclutamiento/dashboard', destination: '/rrhh?vista=reclutamiento', permanent: true },
      { source: '/reclutamiento', destination: '/rrhh?vista=reclutamiento', permanent: false },
      { source: '/reclutamiento/:path*', destination: '/rrhh?vista=reclutamiento', permanent: false },
      { source: '/registro', destination: '/rrhh/registro', permanent: false },
      { source: '/registro/:path*', destination: '/rrhh/registro', permanent: false },
      { source: '/talento', destination: '/rrhh', permanent: false },
      { source: '/talento/:path*', destination: '/rrhh', permanent: false },
      { source: '/operaciones/inventario', destination: '/almacen?cuadro=inventario', permanent: true },
      { source: '/almacen/movimientos', destination: '/almacen?cuadro=movimientos', permanent: true },
      { source: '/almacen/movimientos/:path*', destination: '/almacen?cuadro=movimientos', permanent: true },
      { source: '/almacen/kardex', destination: '/almacen?cuadro=trazabilidad', permanent: true },
      { source: '/almacen/kardex/:path*', destination: '/almacen?cuadro=trazabilidad', permanent: true },
      { source: '/almacen/trazabilidad', destination: '/almacen?cuadro=trazabilidad', permanent: false },
      { source: '/almacen/procurement', destination: '/almacen/recepcion?tab=transito', permanent: true },
      { source: '/almacen/procurement/quality', destination: '/almacen/recepcion?tab=transito', permanent: true },
    ];
  },

  // ─── Webpack ────────────────────────────────────────────────────────────────────
  webpack: (config, { dev, isServer }) => {
    // En dev: aumentar timeout de carga de chunks y desactivar caché filesystem
    // (evita "Cannot find module './1682.js'" tras hot-reload agresivo)
    if (dev) {
      if (config.output) config.output.chunkLoadTimeout = 300_000;
      config.cache = false;
    }

    // NetVision (react-konva): forzar build browser de konva y stub de canvas.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
      konva: path.join(__dirname, 'node_modules/konva/lib/index.js'),
    };

    if (isServer) {
      // No bundlear mdb-reader: Node resuelve la entrada "node" del paquete en runtime
      const prev = config.externals;
      const mdbExternal = ({ request }, callback) => {
        if (request === 'mdb-reader' || (typeof request === 'string' && request.startsWith('mdb-reader/'))) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      };
      if (Array.isArray(prev)) {
        config.externals = [...prev, mdbExternal];
      } else if (typeof prev === 'function') {
        config.externals = (ctx, cb) => {
          mdbExternal(ctx, (err, result) => {
            if (result) return cb(err, result);
            prev(ctx, cb);
          });
        };
      } else {
        config.externals = [mdbExternal];
      }
    }

    // Excluir canvas/fs del bundle del cliente
    if (!isServer) {
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
