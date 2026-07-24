import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Módulo Abogado | Casa Inteligente Legal',
  description:
    'Software legal para despachos: casos, contratos, asesor y cálculos. Sin el CRM de obras.',
};

export default function AbogadoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#07090f] text-zinc-100">{children}</div>;
}
