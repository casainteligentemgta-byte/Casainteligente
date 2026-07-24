import { PresupuestoDetalle } from '@/components/presupuesto/PresupuestoDetalle';
import { PresupuestoToolbar } from './PresupuestoToolbar';

export const metadata = {
  title: 'Presupuesto P-49 · Casa Inteligente',
};

export default function PresupuestoP49Page() {
  return (
    <div className="min-h-screen bg-slate-950 py-6 print:bg-white print:py-0">
      <PresupuestoToolbar />
      <div className="mx-auto print:max-w-none">
        <PresupuestoDetalle />
      </div>
    </div>
  );
}
