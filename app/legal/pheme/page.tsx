import PhemeTabsClient from '@/components/pheme/PhemeTabsClient';
import { PHEME_NOMBRE } from '@/lib/pheme/identidad';

export default function LegalPhemePage() {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/80">
          Agentes · Legal
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">{PHEME_NOMBRE}</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Minutas y análisis de reuniones (acuerdos, responsables, pendientes). Disponible también
          desde el departamento legal.
        </p>
      </header>
      <PhemeTabsClient mostrarEnlaceStandalone />
    </div>
  );
}
