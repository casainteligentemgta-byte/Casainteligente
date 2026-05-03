import Link from 'next/link';
import { cookies } from 'next/headers';
import { loadSession } from '@/lib/recruitment/session-store';
import { buildCeoPayload } from '@/lib/recruitment/scoring';
import {
  ceoSecretConfigured,
  recruitmentAllowSupabaseUser,
  recruitmentCeoCookieName,
  verifyRecruitmentCeoAuthorized,
} from '@/lib/recruitment/ceo-auth';
import { hasSupabaseCeoSession } from '@/lib/recruitment/ceo-auth-server';
import CeoLoginForm from './CeoLoginForm';
import CeoLogoutButton from './CeoLogoutButton';
import MonitorReclutamiento from './MonitorReclutamiento';
import GacetaOficiosReferencia from './GacetaOficiosReferencia';
import NeedProtocolSection from './NeedProtocolSection';
import GenerarOnboardingLinkSection from './GenerarOnboardingLinkSection';
import BancaDeTalentoDashboard from './BancaDeTalentoDashboard';
import DashboardRRHH from './DashboardRRHH';

type PageProps = { searchParams: { session?: string; key?: string } };

async function ReclutamientoDashboardInner({ searchParams }: PageProps) {
  const sessionId = searchParams.session?.trim();
  const searchKey = searchParams.key?.trim() ?? null;
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(recruitmentCeoCookieName())?.value;
  const hasSupabaseUser = await hasSupabaseCeoSession();
  const authorized = verifyRecruitmentCeoAuthorized({
    cookieVal,
    searchKey,
    hasSupabaseUser,
  });

  const needsGate =
    ceoSecretConfigured() || recruitmentAllowSupabaseUser();
  const showLogin = needsGate && !authorized;

  let payload: ReturnType<typeof buildCeoPayload> | null = null;
  let fetchError: string | null = null;

  if (authorized && sessionId) {
    const state = await loadSession(sessionId);
    if (!state) fetchError = 'Sesión no encontrada';
    else {
      try {
        const analyses = Array.isArray(state.analyses) ? state.analyses : [];
        payload = buildCeoPayload(state, analyses);
      } catch (e) {
        fetchError = e instanceof Error ? e.message : 'No se pudo armar el resumen de la sesión';
      }
    }
  }

  const sem = payload?.semaphore;

  if (showLogin) {
    return (
      <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto" style={{ background: 'var(--bg-primary)' }}>
        <h1 className="text-xl font-semibold text-white mb-2">Reclutamiento — vista CEO</h1>
        <CeoLoginForm />
        <p className="text-sm">
          <Link href="/reclutamiento" className="text-blue-400 hover:underline">
            Ir a la entrevista (candidato)
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full max-w-7xl mx-auto min-w-0 overflow-x-hidden px-4 py-8 pb-32 sm:pb-28"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h1 className="text-xl font-semibold text-white">Reclutamiento — centro de mando RRHH</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reclutamiento/requisicion"
            className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-3 py-2 text-xs font-medium text-amber-100 hover:border-amber-400/50 hover:bg-amber-950/40"
          >
            Requisición personal (obrero o empleado)
          </Link>
          <Link
            href="/proyectos/nuevo"
            className="rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Nuevo proyecto
          </Link>
          {needsGate ? <CeoLogoutButton /> : null}
        </div>
      </div>

      {!needsGate ? (
        <p className="text-xs text-amber-400/90 mb-4">
          Aviso: sin <code className="text-amber-200">RECRUITMENT_CEO_SECRET</code> ni{' '}
          <code className="text-amber-200">RECRUITMENT_ALLOW_SUPABASE_USER</code> esta página es pública.
          Configúrala en producción.
        </p>
      ) : null}

      <DashboardRRHH />

      <GacetaOficiosReferencia />
      <NeedProtocolSection />
      <GenerarOnboardingLinkSection />

      <MonitorReclutamiento />
      <BancaDeTalentoDashboard />

      <p className="text-sm text-zinc-400 mb-6">
        Pega el ID de sesión que te comparte el candidato al terminar (query{' '}
        <code className="text-zinc-300">?session=uuid</code>). API:{' '}
        <code className="text-zinc-300">Authorization: Bearer …</code> o{' '}
        <code className="text-zinc-300">?key=</code>
        .
      </p>

      <form className="flex gap-2 mb-8" action="/reclutamiento/dashboard" method="get">
        <input
          name="session"
          defaultValue={sessionId ?? ''}
          placeholder="UUID de sesión"
          className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="rounded-xl px-4 py-2 text-sm font-medium bg-zinc-700 text-white"
        >
          Cargar
        </button>
      </form>

      {fetchError ? <p className="text-red-400 text-sm mb-4">{fetchError}</p> : null}

      {payload && (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{
                background:
                  sem?.level === 'red'
                    ? '#ef4444'
                    : sem?.level === 'yellow'
                      ? '#eab308'
                      : '#22c55e',
              }}
            />
            <span className="text-white font-medium">{sem?.label ?? '—'}</span>
          </div>
          <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
            {(() => {
              try {
                return JSON.stringify(payload, null, 2);
              } catch {
                return 'No se pudo serializar el resumen (datos no representables en JSON).';
              }
            })()}
          </pre>
        </div>
      )}

      <p className="mt-8 text-sm">
        <Link href="/reclutamiento" className="text-blue-400 hover:underline">
          Ir a la entrevista (candidato)
        </Link>
      </p>
    </div>
  );
}

export default async function ReclutamientoDashboardPage(props: PageProps) {
  try {
    return await ReclutamientoDashboardInner(props);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[reclutamiento/dashboard]', e);
    return (
      <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto" style={{ background: 'var(--bg-primary)' }}>
        <h1 className="text-xl font-semibold text-white mb-2">No se pudo cargar el panel</h1>
        <p className="text-sm text-red-300 rounded-xl border border-red-500/30 bg-red-950/40 p-4">{msg}</p>
        <p className="mt-4 text-sm">
          <Link href="/reclutamiento" className="text-blue-400 hover:underline">
            Volver a reclutamiento
          </Link>
        </p>
      </div>
    );
  }
}
