'use client'

/** Stubs de módulos Fase 2–7 (roadmap NetVision Pro). */

function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-4 text-xs text-[var(--nexus-text-dim)]">
      <p className="font-semibold text-[var(--nexus-text-muted)]">{title}</p>
      <p className="mt-1">Roadmap {phase} — próximamente.</p>
    </div>
  )
}

/** NetworkDesigner real: components/netvision/NetworkDesigner.tsx (Fase 2). */

/** DiagramGenerator real: components/netvision/DiagramGenerator.tsx (Fase 3). */

/** CableRoutingEngine / ConduitCalculator reales (Fase 4). */

/** UndergroundCanalizationTool real (Fase 5). */

export function ComplianceValidatorPanel() {
  return <ComingSoon title="Validador NEC / IEC / NFPA / TIA" phase="Fase 6" />
}

export function BIMViewer() {
  return <ComingSoon title="Visor BIM / IFC / Revit package" phase="Fase 7" />
}

export function AutomationEditor() {
  return <ComingSoon title="Automatización / Dynamo scripts" phase="Fase 7" />
}
