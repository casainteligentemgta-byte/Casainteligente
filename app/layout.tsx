import type { Metadata } from "next";
import AppChrome from "@/components/AppChrome";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
                className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased text-[var(--label-primary)]`}
            >
                <div
                    className="min-h-screen app-root-bg"
                    style={{
                        backgroundColor: 'var(--bg-primary)',
                    }}
                >
                    <AppChrome>{children}</AppChrome>
                </div>
            </body>
        </html>
    );
}
