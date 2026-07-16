import type { Metadata } from 'next';
import DashboardOperativoClient from '@/components/admin/DashboardOperativoClient';

export const metadata: Metadata = {
  title: 'Dashboard operativo — Casa Inteligente',
  description: 'KPIs de mano de obra, comparativo por proyecto y urgencias de solicitudes.',
};

export default function DashboardOperativoPage() {
  return <DashboardOperativoClient />;
}
