import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-nexus-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Casa Inteligente — CRM",
    description: "Sistema de Gestión de Clientes · Security & Domotics",
};

/** Sin esto, `next build` intenta prerender rutas que crean cliente Supabase y falla si faltan env (p. ej. Vercel sin variables). */
export const dynamic = "force-dynamic";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable}`}
                style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
            >
                <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
                    <AppChrome>{children}</AppChrome>
                </div>
            </body>
        </html>
    );
}
