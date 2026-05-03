'use client';

import { useState } from 'react';

export default function BancaDeTalentoDashboard() {
  const [isAssigning, setIsAssigning] = useState<string | null>(null);

  const banca = [
    { id: '1', nombre: 'Carlos Mendoza', cargo: 'Albañil de 1ra', nivel: 5, veredicto: 'Verde', confianza: 92 },
    { id: '2', nombre: 'Luis Torrealba', cargo: 'Electricista', nivel: 6, veredicto: 'Verde', confianza: 88 },
    { id: '3', nombre: 'Miguel Sánchez', cargo: 'Ayudante', nivel: 2, veredicto: 'Amarillo', confianza: 75 },
  ];

  const proyectosActivos = [
    { id: 'p1', nombre: 'Torre Inteligente A' },
    { id: 'p2', nombre: 'Residencias El Bosque' },
  ];

  const handleAsignar = async (empleadoId: string, proyectoId: string) => {
    alert(`Empleado ${empleadoId} asignado al proyecto ${proyectoId}. Redactando contrato...`);
    setIsAssigning(null);
  };

  return (
    <section className="mt-8 max-w-full min-w-0 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-xl sm:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Banca de talento</h2>
        <p className="mt-1 text-sm text-zinc-400">Personal evaluado por IA, listo para despliegue operativo.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {banca.map((emp) => (
          <div
            key={emp.id}
            className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-5 shadow-md transition hover:border-white/15"
          >
            <div>
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-white">{emp.nombre}</h3>
                  <span className="mt-1 inline-block rounded-lg border border-[#FF9500]/30 bg-[#FF9500]/10 px-2 py-1 text-xs font-medium text-[#FFD60A]">
                    {emp.cargo} (nivel {emp.nivel})
                  </span>
                </div>
                <div
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full shadow-md ${
                    emp.veredicto === 'Verde'
                      ? 'bg-emerald-400 shadow-emerald-500/40'
                      : 'bg-amber-400 shadow-amber-500/40'
                  }`}
                  title={`Veredicto: ${emp.veredicto}`}
                />
              </div>

              <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Índice de confianza IA
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        emp.veredicto === 'Verde' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-amber-400'
                      }`}
                      style={{ width: `${emp.confianza}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#FFD60A]">{emp.confianza}%</span>
                </div>
              </div>
            </div>

            {isAssigning === emp.id ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Seleccionar proyecto
                </label>
                <select
                  className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#FF9500]/40"
                  onChange={(e) => void handleAsignar(emp.id, e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Elegir destino…
                  </option>
                  {proyectosActivos.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAssigning(null)}
                  className="w-full text-center text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAssigning(emp.id)}
                className="w-full rounded-xl bg-gradient-to-r from-[#FFD60A] via-[#FFB020] to-[#FF9500] py-3 text-sm font-bold text-[#0A0A0F] shadow-[0_0_12px_rgba(249,115,22,0.25)] transition hover:brightness-105 active:scale-[0.99]"
              >
                Asignar a proyecto
              </button>
            )}
          </div>
        ))}

        {banca.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-white/15 bg-black/20 p-12 text-center">
            <span className="mb-3 block text-3xl opacity-60" aria-hidden>
              —
            </span>
            <h3 className="text-base font-bold text-zinc-200">La banca está vacía</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Crea una necesidad de servicio en un proyecto para reclutar nuevo personal.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
