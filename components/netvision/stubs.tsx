'use client'

/** Stubs residuales NetVision Pro (módulos ya implementados se importan directo). */

function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-4 text-xs text-[var(--nexus-text-dim)]">
      <p className="font-semibold text-[var(--nexus-text-muted)]">{title}</p>
      <p className="mt-1">Roadmap {phase} — próximamente.</p>
    </div>
  )
}

/** Fases 1–7 implementadas en components/netvision/* dedicados. */

export function AutomationEditor() {
  return (
    <ComingSoon
      title="Editor automatización avanzada"
      phase="Dynamo ya se exporta desde pestaña BIM"
    />
  )
}
