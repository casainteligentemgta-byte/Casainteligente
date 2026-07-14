import LegalShell from '@/components/legal/LegalShell';
import LegalAccessGate from '@/components/legal/LegalAccessGate';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Departamento Legal | Casa Inteligente',
  description: 'Resolución de casos: obras, despacho general y asuntos externos.',
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <LegalShell>
      <LegalAccessGate>{children}</LegalAccessGate>
    </LegalShell>
  );
}
