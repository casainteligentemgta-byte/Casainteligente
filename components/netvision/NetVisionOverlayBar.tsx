'use client'

import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CameraScenario } from '@/lib/netvision/types'
import {
  ALL_SCENARIOS_ID,
  PRINCIPAL_SCENARIO_ID,
} from '@/lib/netvision/utils/cameraScenarios'
import {
  OVERLAY_PLAN_SYSTEMS,
  OVERLAY_SYSTEM_LABEL,
  type OverlayPlanSystem,
  type OverlayVista,
} from '@/lib/netvision/utils/overlayVisibility'

const chip = (active: boolean, tactico: boolean) =>
  cn(
    'shrink-0 min-h-8 rounded-md px-2.5 py-1 text-[11px] font-semibold',
    tactico
      ? active
        ? 'bg-[#8cffb5] text-[#07110d]'
        : 'border border-[#8cffb5] text-[#8cffb5] hover:bg-[#8cffb5]/10'
      : active
        ? 'bg-[var(--nexus-cyan)] text-black'
        : 'border border-white/15 text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white',
  )

export type NetVisionOverlayBarProps = {
  vista: OverlayVista
  onVista: (vista: OverlayVista) => void
  /** En la vista cliente: chips de sistema. En el editor la especialidad ya está arriba. */
  showSystems?: boolean
  activeSystem?: OverlayPlanSystem | 'todas'
  onSystem?: (system: OverlayPlanSystem | 'todas') => void
  showScenarios?: boolean
  scenarios: readonly CameraScenario[]
  scenarioId: string
  onScenario: (id: string) => void
  onAddScenario?: () => void
  onRemoveScenario?: (id: string) => void
  variant?: 'nexus' | 'tactico'
}

export default function NetVisionOverlayBar({
  vista,
  onVista,
  showSystems = false,
  activeSystem,
  onSystem,
  showScenarios = false,
  scenarios,
  scenarioId,
  onScenario,
  onAddScenario,
  onRemoveScenario,
  variant = 'nexus',
}: NetVisionOverlayBarProps) {
  const tactico = variant === 'tactico'
  const todas = vista === 'todas' || activeSystem === 'todas'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1',
        tactico ? 'text-[#d6ffe5]' : '',
      )}
      data-nv-overlay-bar
    >
      <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {showSystems ? (
          <>
            {OVERLAY_PLAN_SYSTEMS.map((id) => (
              <button
                key={id}
                type="button"
                data-nv-capa={id}
                aria-pressed={!todas && activeSystem === id}
                className={chip(!todas && activeSystem === id, tactico)}
                onClick={() => onSystem?.(id)}
              >
                {OVERLAY_SYSTEM_LABEL[id]}
              </button>
            ))}
            <button
              type="button"
              data-nv-vista="todas"
              aria-pressed={todas}
              className={chip(todas, tactico)}
              onClick={() => {
                onVista('todas')
                onSystem?.('todas')
              }}
            >
              Todas
            </button>
          </>
        ) : (
          <>
            <span
              className={cn(
                'shrink-0 text-[10px] font-semibold uppercase tracking-wide',
                tactico ? 'text-[#7dffb0]/80' : 'text-[var(--nexus-text-dim)]',
              )}
            >
              Ver
            </span>
            <button
              type="button"
              data-nv-vista="solo"
              aria-pressed={vista === 'solo'}
              title="Solo el sistema que estás trabajando"
              className={chip(vista === 'solo', tactico)}
              onClick={() => onVista('solo')}
            >
              Solo este
            </button>
            <button
              type="button"
              data-nv-vista="todas"
              aria-pressed={vista === 'todas'}
              title="CCTV, alarma, domótica y el resto a la vez"
              className={chip(vista === 'todas', tactico)}
              onClick={() => onVista('todas')}
            >
              Todos
            </button>
          </>
        )}
      </div>
      {showScenarios ? (
        <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          <span
            className={cn(
              'shrink-0 text-[10px] font-semibold uppercase tracking-wide',
              tactico ? 'text-[#7dffb0]/80' : 'text-[var(--nexus-text-dim)]',
            )}
          >
            CCTV
          </span>
          {scenarios.map((s) => {
            const active = !todas && scenarioId === s.id
            return (
              <span key={s.id} className="inline-flex shrink-0 items-center">
                <button
                  type="button"
                  data-nv-escenario={s.id}
                  aria-pressed={active}
                  className={cn(
                    chip(active, tactico),
                    onRemoveScenario && s.id !== PRINCIPAL_SCENARIO_ID
                      ? 'rounded-r-none'
                      : '',
                  )}
                  onClick={() => onScenario(s.id)}
                >
                  {s.name}
                </button>
                {onRemoveScenario && s.id !== PRINCIPAL_SCENARIO_ID ? (
                  <button
                    type="button"
                    title={`Quitar ${s.name}`}
                    aria-label={`Quitar ${s.name}`}
                    className={cn(
                      chip(active, tactico),
                      'rounded-l-none border-l-0 px-1.5',
                    )}
                    onClick={() => onRemoveScenario(s.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </span>
            )
          })}
          {scenarios.length > 1 ? (
            <button
              type="button"
              data-nv-escenario={ALL_SCENARIOS_ID}
              aria-pressed={!todas && scenarioId === ALL_SCENARIOS_ID}
              className={chip(!todas && scenarioId === ALL_SCENARIOS_ID, tactico)}
              onClick={() => onScenario(ALL_SCENARIOS_ID)}
            >
              Cámaras · todos
            </button>
          ) : null}
          {onAddScenario ? (
            <button
              type="button"
              data-nv-escenario-nuevo
              title="Otro escenario de cámaras en este plano"
              className={chip(false, tactico)}
              onClick={onAddScenario}
            >
              <Plus className="mr-0.5 inline h-3 w-3" />
              Escenario
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
