import { NexusShell } from '@/components/nexus/NexusShell';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nexus Home · ERP/CRM',
  description: 'Plataforma de gestión empresarial — domótica de lujo',
};

export default function NexusLayout({ children }: { children: React.ReactNode }) {
  return <NexusShell>{children}</NexusShell>;
}
