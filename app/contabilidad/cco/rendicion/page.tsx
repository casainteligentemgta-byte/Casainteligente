import type { Metadata } from 'next';
import CcoRendicionClient from '@/components/contabilidad/cco/CcoRendicionClient';

export const metadata: Metadata = { title: 'Rendición de cuentas · CCO' };

/** Rendición de cuentas de una obra por administración delegada (semana, mes o toda la obra). */
export default function CcoRendicionPage() {
  return <CcoRendicionClient />;
}
