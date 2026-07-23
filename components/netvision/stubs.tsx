'use client'

/**
 * Roadmap NetVision Pro — Fases 2–7 implementadas en módulos dedicados:
 *
 * - Fase 2: NetworkDesigner.tsx + poeAnalyzer / wifiPredictor / channelOptimizer
 * - Fase 3: DiagramGenerator.tsx + diagramBuilder
 * - Fase 4: CableRoutingEngine.tsx + ConduitCalculator.tsx
 * - Fase 5: UndergroundCanalizationTool.tsx + canalizationCalculator
 * - Fase 6: ComplianceValidator.tsx + complianceValidator service
 * - Fase 7: BIMViewer.tsx + bimExporter
 *
 * Este archivo solo documenta el mapa; no exporta stubs activos.
 */

export const NETVISION_ROADMAP_STATUS = {
  phase1_cctv: 'done',
  phase2_network: 'done',
  phase3_diagram: 'done',
  phase4_cabling: 'done',
  phase5_underground: 'done',
  phase6_compliance: 'done',
  phase7_bim: 'done',
  phase8_projects_prefs_bom: 'done',
  phase9_supabase_persist: 'done',
} as const
