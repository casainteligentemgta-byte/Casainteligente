export default function ReclutamientoDashboardLoading() {
  return (
    <div
      className="min-h-screen w-full max-w-7xl mx-auto min-w-0 overflow-x-hidden px-4 py-8 pb-32"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-zinc-800/80" />
      <div className="mb-4 h-4 w-full max-w-xl animate-pulse rounded bg-zinc-800/60" />
      <div className="mb-10 h-72 animate-pulse rounded-2xl border border-white/5 bg-zinc-900/40" />
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-800/70" />
        <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-zinc-900/30" />
      </div>
      <p className="mt-8 text-center text-xs text-zinc-500">Cargando centro de mando RRHH…</p>
    </div>
  )
}
