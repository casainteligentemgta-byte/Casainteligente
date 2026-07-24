'use client';

import {
  Calculator,
  HardHat,
  Layers,
  Package,
  Wrench,
  Building2,
  ChevronRight,
} from 'lucide-react';

/* ─── Mock: Proyecto El Flamboyán ─── */
const PROYECTO = {
  nombre: 'El Flamboyán',
  capitulo: 'Obras Civiles / Mampostería y Cerramientos',
};

const PARTIDA = {
  codigo: 'PAR-CIV-022',
  descripcion:
    'Construcción de paredes de bloques de arcilla de 15 cm de espesor, asentados con mortero 1:4, incluye acabado corriente para revestir.',
  unidad: 'm²',
  cantidad: 850,
  precioDirecto: 14.2,
  total: 12_070,
};

const APU = {
  rendimiento: 22,
  unidad: 'm²',
  materiales: [
    { codigo: 'BLOQ-ARC15', desc: 'Bloque de arcilla de 15x20x40 cm', uni: 'pza', cant: 12.5, precio: 0.45, total: 5.63 },
    { codigo: 'CEM-PORT01', desc: 'Cemento Portland Gris (Saco)', uni: 'saco', cant: 0.22, precio: 8.5, total: 1.87 },
    { codigo: 'ARE-LAV002', desc: 'Arena lavada para mortero', uni: 'm³', cant: 0.025, precio: 24, total: 0.6 },
    { codigo: 'AGUA-OBRA', desc: 'Agua para preparación de mezcla', uni: 'L', cant: 5, precio: 0.02, total: 0.1 },
  ],
  subtotalMateriales: 8.2,
  equipos: [
    { codigo: 'HERR-MEN05', desc: 'Herramientas Menores (5% de Mano de Obra)', cant: 1, tarifa: 'Calculado', costoDiario: 4.97, costoUnit: 0.23 },
    { codigo: 'ANDAM-SEC1', desc: 'Andamio tubular de sección estándar', cant: 2, tarifa: 3.5, costoDiario: 7, costoUnit: 0.32 },
    { codigo: 'MEZC-TROM', desc: 'Mezcladora de concreto (Trompo 1 saco)', cant: 0.5, tarifa: 30, costoDiario: 15, costoUnit: 0.68 },
  ],
  subtotalEquiposDiario: 26.97,
  subtotalEquiposUnit: 1.23,
  manoObra: [
    { codigo: 'MO-ALBA01', desc: 'Albañil de Primera', cant: 1, salario: 20, bono: 8, totalDiario: 28 },
    { codigo: 'MO-AYUD01', desc: 'Ayudante / Preparador', cant: 1, salario: 14, bono: 6, totalDiario: 20 },
    { codigo: 'MO-MAES02', desc: 'Maestro de Obra (Fracción de supervisión)', cant: 0.1, salario: 25, bono: 10, totalDiario: 3.5 },
  ],
  subtotalSalarios: 34.5,
  prestacionesSociales: 20.7,
  totalBonificaciones: 14,
  totalDiarioCuadrilla: 99.2,
  subtotalManoObraUnit: 4.51,
};

const CIERRE = {
  materiales: 8.2,
  equipos: 1.23,
  manoObra: 4.51,
  costoDirecto: 13.94,
  adminPct: 15,
  adminMonto: 2.09,
  utilidadPct: 10,
  utilidadMonto: 1.6,
  precioUnitarioFinal: 17.63,
};

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtUsd(n: number, dec = 2): string {
  return `$${fmt(n, dec)}`;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono = false,
  className = '',
}: {
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 text-sm text-slate-200 ${mono ? 'font-mono tabular-nums' : ''} ${className}`}
    >
      {children}
    </td>
  );
}

function SectionCard({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/60 shadow-sm backdrop-blur-sm">
      <header className={`flex items-center gap-3 border-b border-slate-700/80 px-5 py-4 ${accent}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
          <Icon className="h-4 w-4 text-slate-200" />
        </div>
        <h2 className="text-sm font-bold tracking-wide text-white">{title}</h2>
      </header>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function SubtotalRow({ label, value, cols }: { label: string; value: string; cols: number }) {
  return (
    <tr className="border-t border-slate-600/80 bg-slate-800/50">
      <td colSpan={cols - 1} className="px-4 py-3 text-right text-xs font-semibold uppercase text-emerald-400">
        {label}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums text-emerald-300">
        {value}
      </td>
    </tr>
  );
}

export default function ElFlamboyanLuloViewerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8 md:py-10">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-400">
              <Building2 className="h-3.5 w-3.5" />
              LuloWeb ERP · Vista demostración
            </div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{PROYECTO.nombre}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-400">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              {PROYECTO.capitulo}
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-mono text-indigo-300">{PARTIDA.codigo}</span>
            </p>
          </div>
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-wider text-indigo-300">Precio unitario APU</p>
            <p className="font-mono text-2xl font-bold text-indigo-200">{fmtUsd(CIERRE.precioUnitarioFinal)}</p>
            <p className="text-xs text-slate-500">por {APU.unidad}</p>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-1">
          {/* 1. PRESUPUESTO */}
          <SectionCard
            title="Presupuesto de obra"
            icon={Layers}
            accent="bg-gradient-to-r from-indigo-950/80 to-transparent"
          >
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-slate-800/80">
                  <tr>
                    <Th>Capítulo</Th>
                    <Th>Código Lulo</Th>
                    <Th className="min-w-[280px]">Descripción</Th>
                    <Th>Unidad</Th>
                    <Th className="text-right">Cantidad</Th>
                    <Th className="text-right">Precio directo ($)</Th>
                    <Th className="text-right">Total ($)</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-700/50 hover:bg-slate-800/30">
                    <Td className="text-xs text-slate-400">{PROYECTO.capitulo}</Td>
                    <Td mono className="font-semibold text-indigo-300">
                      {PARTIDA.codigo}
                    </Td>
                    <Td className="max-w-md text-slate-300">{PARTIDA.descripcion}</Td>
                    <Td mono>{PARTIDA.unidad}</Td>
                    <Td mono className="text-right">
                      {fmt(PARTIDA.cantidad, 2)}
                    </Td>
                    <Td mono className="text-right text-blue-300">
                      {fmt(PARTIDA.precioDirecto, 2)}
                    </Td>
                    <Td mono className="text-right font-semibold text-emerald-400">
                      {fmt(PARTIDA.total, 2)}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Precio directo en presupuesto ({fmtUsd(PARTIDA.precioDirecto)}) × cantidad ={' '}
              {fmtUsd(PARTIDA.total)}. El cierre APU analítico arroja{' '}
              <span className="font-mono text-indigo-300">{fmtUsd(CIERRE.precioUnitarioFinal)}</span> con
              administración y utilidad.
            </p>
          </SectionCard>

          {/* 2. APU */}
          <SectionCard
            title="Análisis de precio unitario (APU)"
            icon={Calculator}
            accent="bg-gradient-to-r from-slate-800/80 to-transparent"
          >
            <div className="mb-6 flex flex-wrap gap-6 rounded-lg border border-slate-700/60 bg-slate-800/40 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Rendimiento</p>
                <p className="font-mono text-lg font-semibold text-white">
                  {fmt(APU.rendimiento, 2)} <span className="text-sm text-slate-400">{APU.unidad} / Día</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Unidad de partida</p>
                <p className="font-mono text-lg font-semibold text-white">{APU.unidad}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Partida</p>
                <p className="font-mono text-sm text-indigo-300">{PARTIDA.codigo}</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* A. Materiales */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-300">
                  <Package className="h-4 w-4" />
                  A. Materiales consumibles
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="bg-slate-800/80">
                      <tr>
                        <Th>Código insumo</Th>
                        <Th>Descripción material</Th>
                        <Th>Unidad</Th>
                        <Th className="text-right">Cantidad (aporte)</Th>
                        <Th className="text-right">Precio ($)</Th>
                        <Th className="text-right">Total ($)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {APU.materiales.map((r) => (
                        <tr key={r.codigo} className="border-t border-slate-700/40 hover:bg-slate-800/20">
                          <Td mono className="text-blue-200/90">{r.codigo}</Td>
                          <Td>{r.desc}</Td>
                          <Td mono>{r.uni}</Td>
                          <Td mono className="text-right">{fmt(r.cant, 4)}</Td>
                          <Td mono className="text-right">{fmt(r.precio, 2)}</Td>
                          <Td mono className="text-right">{fmt(r.total, 2)}</Td>
                        </tr>
                      ))}
                      <SubtotalRow
                        label="Sub-total materiales"
                        value={fmtUsd(APU.subtotalMateriales)}
                        cols={6}
                      />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* B. Equipos */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Wrench className="h-4 w-4" />
                  B. Equipos y herramientas
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="bg-slate-800/80">
                      <tr>
                        <Th>Código insumo</Th>
                        <Th>Descripción equipo / herramienta</Th>
                        <Th className="text-right">Cantidad</Th>
                        <Th className="text-right">Tarifa diaria ($)</Th>
                        <Th className="text-right">Costo diario ($)</Th>
                        <Th className="text-right">Costo unitario ($)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {APU.equipos.map((r) => (
                        <tr key={r.codigo} className="border-t border-slate-700/40 hover:bg-slate-800/20">
                          <Td mono className="text-amber-200/90">{r.codigo}</Td>
                          <Td>{r.desc}</Td>
                          <Td mono className="text-right">{r.cant}</Td>
                          <Td mono className="text-right">
                            {typeof r.tarifa === 'number' ? fmt(r.tarifa, 2) : r.tarifa}
                          </Td>
                          <Td mono className="text-right">{fmt(r.costoDiario, 2)}</Td>
                          <Td mono className="text-right">{fmt(r.costoUnit, 2)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-4 rounded-lg border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-sm">
                  <span className="text-slate-400">
                    Sub-total equipos · Costo diario:{' '}
                    <strong className="font-mono text-amber-200">{fmtUsd(APU.subtotalEquiposDiario)}</strong>
                  </span>
                  <span className="text-slate-400">
                    Costo unitario (÷ rend. {APU.rendimiento}):{' '}
                    <strong className="font-mono text-emerald-300">{fmtUsd(APU.subtotalEquiposUnit)}</strong>
                  </span>
                </div>
              </div>

              {/* C. Mano de obra */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
                  <HardHat className="h-4 w-4" />
                  C. Mano de obra (cuadrilla de albañilería)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                  <table className="w-full min-w-[680px] border-collapse">
                    <thead className="bg-slate-800/80">
                      <tr>
                        <Th>Código insumo</Th>
                        <Th>Personal calificado</Th>
                        <Th className="text-right">Cantidad</Th>
                        <Th className="text-right">Salario diario ($)</Th>
                        <Th className="text-right">Bono diario ($)</Th>
                        <Th className="text-right">Total diario ($)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {APU.manoObra.map((r) => (
                        <tr key={r.codigo} className="border-t border-slate-700/40 hover:bg-slate-800/20">
                          <Td mono className="text-violet-200/90">{r.codigo}</Td>
                          <Td>{r.desc}</Td>
                          <Td mono className="text-right">{fmt(r.cant, 2)}</Td>
                          <Td mono className="text-right">{fmt(r.salario, 2)}</Td>
                          <Td mono className="text-right">{fmt(r.bono, 2)}</Td>
                          <Td mono className="text-right font-medium">{fmt(r.totalDiario, 2)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-2 rounded-lg border border-violet-500/20 bg-violet-950/20 px-5 py-4 text-sm">
                  <div className="flex justify-between border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400">Subtotal salarios diarios</span>
                    <span className="font-mono font-semibold text-slate-200">{fmtUsd(APU.subtotalSalarios)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400">Prestaciones sociales (60% sobre salarios básicos)</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {fmtUsd(APU.prestacionesSociales)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-700/50 pb-2">
                    <span className="text-slate-400">Total bonificaciones diarias</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {fmtUsd(APU.totalBonificaciones)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-semibold text-violet-200">Total diario de cuadrilla</span>
                    <span className="font-mono text-lg font-bold text-violet-100">
                      {fmtUsd(APU.totalDiarioCuadrilla)}
                    </span>
                  </div>
                  <div className="flex justify-between rounded-md bg-slate-900/60 px-3 py-2">
                    <span className="text-emerald-400/90">
                      Sub-total mano de obra ({fmtUsd(APU.totalDiarioCuadrilla)} ÷ {APU.rendimiento})
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      {fmtUsd(APU.subtotalManoObraUnit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 3. CIERRE FINANCIERO */}
          <section className="overflow-hidden rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-emerald-950/30 p-6 shadow-lg md:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-200">
              <Calculator className="h-5 w-5" />
              Resumen del cierre financiero · Lulo Core Engine
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
                <p className="text-[10px] uppercase text-slate-500">Materiales</p>
                <p className="font-mono text-xl font-semibold text-blue-300">{fmtUsd(CIERRE.materiales)}</p>
              </div>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
                <p className="text-[10px] uppercase text-slate-500">Equipos</p>
                <p className="font-mono text-xl font-semibold text-amber-300">{fmtUsd(CIERRE.equipos)}</p>
              </div>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
                <p className="text-[10px] uppercase text-slate-500">Mano de obra</p>
                <p className="font-mono text-xl font-semibold text-violet-300">{fmtUsd(CIERRE.manoObra)}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-4">
                <p className="text-[10px] uppercase text-emerald-400/80">Costo directo unitario</p>
                <p className="font-mono text-xl font-bold text-emerald-300">{fmtUsd(CIERRE.costoDirecto)}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {fmtUsd(CIERRE.materiales)} + {fmtUsd(CIERRE.equipos)} + {fmtUsd(CIERRE.manoObra)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-slate-700/60 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-400">
                  Gastos administrativos e imprevistos ({CIERRE.adminPct}%)
                </span>
                <span className="font-mono font-semibold text-slate-200">{fmtUsd(CIERRE.adminMonto)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-400">
                  Utilidad estipulada ({CIERRE.utilidadPct}% sobre costo directo + admin)
                </span>
                <span className="font-mono font-semibold text-slate-200">{fmtUsd(CIERRE.utilidadMonto)}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center rounded-xl border-2 border-indigo-400/50 bg-indigo-500/10 px-6 py-8 text-center shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
                Precio unitario final
              </p>
              <p className="mt-2 font-mono text-4xl font-bold text-white md:text-5xl">
                {fmtUsd(CIERRE.precioUnitarioFinal)}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                por {APU.unidad} construido · {PROYECTO.nombre}
              </p>
              <p className="mt-4 font-mono text-xs text-slate-500">
                {fmtUsd(CIERRE.costoDirecto)} + {fmtUsd(CIERRE.adminMonto)} + {fmtUsd(CIERRE.utilidadMonto)} ={' '}
                {fmtUsd(CIERRE.precioUnitarioFinal)}
              </p>
            </div>
          </section>
        </div>

        <footer className="pb-8 text-center text-xs text-slate-600">
          Demo estática · Proyecto El Flamboyán · Datos de referencia LuloWin
        </footer>
      </div>
    </div>
  );
}
