import FlotaShell from '@/components/flota/FlotaShell';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Flota | Casa Inteligente',
  description: 'Conductores, gasolina, mantenimiento y alertas de la flota de obra.',
};

export default function FlotaLayout({ children }: { children: React.ReactNode }) {
  return <FlotaShell>{children}</FlotaShell>;
}
