import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import IOSNavBar from "@/components/IOSNavBar";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Casa Inteligente — CRM",
    description: "Sistema de Gestión de Clientes · Security & Domotics",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={inter.variable} style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
                <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
                    <main className="pb-24">
                        {children}
                    </main>
                    <IOSNavBar />
                </div>
            </body>
        </html>
    );
}
