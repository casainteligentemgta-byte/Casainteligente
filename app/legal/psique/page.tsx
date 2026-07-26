import PsiqueRecomendarClient from '@/components/talento/psique/PsiqueRecomendarClient';
import { PSIQUE_NOMBRE, PSIQUE_NOMBRE_MITOLOGICO } from '@/lib/talento/psique/identidad';

export default function LegalPsiquePage() {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/80">
          Agentes · Legal
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">
          {PSIQUE_NOMBRE}{' '}
          <span className="text-base font-semibold text-violet-300/80">
            ({PSIQUE_NOMBRE_MITOLOGICO})
          </span>
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Recomienda batería de pruebas y rol de examen según el cargo. Útil para perfiles laborales
          en expedientes o contrataciones.
        </p>
      </header>
      <PsiqueRecomendarClient />
    </div>
  );
}
