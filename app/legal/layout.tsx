import LegalShell from '@/components/legal/LegalShell';
import LegalAccessGate from '@/components/legal/LegalAccessGate';
import { AccesoLegalProvider } from '@/lib/legal/AccesoLegalContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Módulo Abogado | Legal',
  description:
    'Casos, contratos y documentos legales para Casa Inteligente o despachos externos.',
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccesoLegalProvider>
      <LegalShell>
        <LegalAccessGate>{children}</LegalAccessGate>
      </LegalShell>
    </AccesoLegalProvider>
  );
}
