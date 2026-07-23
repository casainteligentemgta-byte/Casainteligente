import type { Metadata } from 'next';
import AppChrome from '@/components/AppChrome';
import ThemeProvider from '@/components/providers/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Casa Inteligente — CRM',
  description: 'Sistema de Gestión de Clientes · Security & Domotics',
};

/** Sin esto, `next build` intenta prerender rutas que crean cliente Supabase y falla si faltan env (p. ej. Vercel sin variables). */
export const dynamic = 'force-dynamic';

/** Anti-FOUC: aplica tema desde localStorage antes del paint. */
const THEME_BOOT_SCRIPT = `(function(){try{var k='ci-theme-v1';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;r.setAttribute('data-theme',t);if(t==='dark')r.classList.add('dark');else r.classList.remove('dark');r.style.colorScheme=t;}catch(e){var d=document.documentElement;d.setAttribute('data-theme','dark');d.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased text-[var(--label-primary)]" suppressHydrationWarning>
        <div
          className="min-h-screen app-root-bg"
          style={{
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <ThemeProvider>
            <AppChrome>{children}</AppChrome>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
