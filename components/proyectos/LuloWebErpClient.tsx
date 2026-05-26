'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronRight,
  FileText,
  FolderOpen,
  HardHat,
  Layers,
  Loader2,
  Package,
  PanelLeft,
  PanelLeftClose,
  Save,
  Wrench,
} from 'lucide-react';
import { calcularApuLuloWin, apuVacio } from '@/lib/proyectos/calcularApuLuloWin';
import { apuPartidaVacio } from '@/lib/proyectos/luloCatalogoApuHelpers';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { LuloWebErpApuPartida, LuloWebErpPayload } from '@/types/lulo-web-erp';

type Props = {
  proyectoId: string;
};

function equiposConHerramientaMenor(
  apu: LuloWebErpApuPartida,
  herramientaMenorDiaria: number,
): LuloWebErpApuPartida['equipos'] {
  const tieneAuto = apu.equipos.some((e) => e.esPorcentajeManoObra);
  if (tieneAuto) return apu.equipos;
  if (apu.manoObra.length === 0) return apu.equipos;
  return [
    ...apu.equipos,
    {
      codigo: 'HM-5MO',
      descripcion: 'Herramientas menores (5% Mano de Obra)',
      cantidad: 1,
      tarifa: 0,
      esPorcentajeManoObra: true,
    },
  ];
}

export default function LuloWebErpClient({ proyectoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LuloWebErpPayload | null>(null);
  const [capituloActivo, setCapituloActivo] = useState<string>('');
  const [partidaSeleccionada, setPartidaSeleccionada] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [apuOverrides, setApuOverrides] = useState<Record<string, LuloWebErpApuPartida>>({});
  const [rendOverrides, setRendOverrides] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/lulo/catalogo-apu`,
      );
      const json = await parseFetchJson<LuloWebErpPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar el presupuesto');
      setData(json);
      setApuOverrides(json.apuByPartidaId ?? {});
      setRendOverrides({});
      const firstCap = json.capitulos[0]?.id ?? '';
      setCapituloActivo(firstCap);
      const partidas = json.partidasByCapitulo[firstCap] ?? [];
      setPartidaSeleccionada(partidas[0]?.id ?? '');
    } catch (e) {
      setError(formatErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const config = data?.config ?? {
    prestacionesSociales: 60,
    gastosAdministrativos: 15,
    utilidad: 10,
  };

  const partidas = useMemo(
    () => data?.partidasByCapitulo[capituloActivo] ?? [],
    [data, capituloActivo],
  );

  const partidaInfo = useMemo(
    () => partidas.find((p) => p.id === partidaSeleccionada) ?? partidas[0],
    [partidas, partidaSeleccionada],
  );

  const apuBase = useMemo(
    () =>
      partidaInfo
        ? (apuOverrides[partidaInfo.id] ??
          data?.apuByPartidaId[partidaInfo.id] ??
          apuVacio())
        : apuVacio(),
    [apuOverrides, data, partidaInfo],
  );

  const rendimiento =
    partidaInfo && partidaInfo.id in rendOverrides
      ? rendOverrides[partidaInfo.id]
      : (partidaInfo?.rendimiento ?? 1);

  const patchApu = useCallback(
    (partidaId: string, updater: (prev: LuloWebErpApuPartida) => LuloWebErpApuPartida) => {
      setApuOverrides((prev) => {
        const base = prev[partidaId] ?? data?.apuByPartidaId[partidaId] ?? apuVacio();
        return { ...prev, [partidaId]: updater({ ...base, materiales: [...base.materiales], equipos: [...base.equipos], manoObra: [...base.manoObra] }) };
      });
      setSaveMsg(null);
    },
    [data],
  );

  const guardarApu = useCallback(async () => {
    if (!partidaInfo || data?.fuente !== 'cascada') return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const apu = apuOverrides[partidaInfo.id] ?? apuBase;
      const lineas = [
        ...apu.materiales.map((m) => ({
          codigo: m.codigo,
          tipo: 'material' as const,
          cantidad: m.cantidad,
          precio: m.precio,
        })),
        ...apu.equipos
          .filter((e) => !e.esPorcentajeManoObra)
          .map((e) => ({
            codigo: e.codigo,
            tipo: 'equipo' as const,
            cantidad: e.cantidad,
            precio: e.tarifa,
          })),
        ...apu.manoObra.map((mo) => ({
          codigo: mo.codigo,
          tipo: 'mano_obra' as const,
          cantidad: mo.cantidad,
          precio: mo.salario,
        })),
      ];
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/lulo/apu-items`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partidaId: partidaInfo.id,
            rendimiento,
            lineas,
          }),
        },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      setSaveMsg('Cambios guardados en la obra');
    } catch (e) {
      setSaveMsg(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [apuBase, apuOverrides, data?.fuente, partidaInfo, proyectoId, rendimiento]);

  const calc = useMemo(
    () => calcularApuLuloWin(apuBase, rendimiento, config),
    [apuBase, rendimiento, config],
  );

  const apu = useMemo(
    () => ({
      ...apuBase,
      equipos: equiposConHerramientaMenor(apuBase, calc.herramientaMenorDiaria),
    }),
    [apuBase, calc.herramientaMenorDiaria],
  );

  const proyectoLabel = data?.proyecto.codigoLulo
    ? `${data.proyecto.codigoLulo} — ${data.proyecto.nombre}`
    : data?.proyecto.nombre ?? 'Proyecto';

  if (loading) {
    return (
      <div className="flex h-[min(80vh,720px)] items-center justify-center rounded-xl border border-slate-200 bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
        <span className="sr-only">Cargando LuloWeb ERP…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold">No se pudo cargar el análisis APU</p>
        <p className="mt-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data?.capitulos.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Sin datos de presupuesto</p>
        <p className="mt-2 text-amber-800">
          Importa el MDB/CSV con{' '}
          <code className="rounded bg-amber-100 px-1">npm run import:lulo-csv</code> o usa
          Importar presupuesto en esta pantalla.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[min(85vh,900px)] overflow-hidden rounded-xl border border-slate-200 bg-white font-sans text-slate-800 shadow-lg">
      {sidebarOpen ? (
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 md:w-80">
        <div className="flex items-center space-x-3 border-b border-slate-800 bg-slate-950 p-4">
          <Layers className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wide text-white">LuloWeb ERP</h1>
            <p className="text-xs text-slate-400">Control de Obras & APU</p>
          </div>
        </div>

        <div className="bg-slate-800/40 p-4">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Proyecto activo
          </span>
          <div className="truncate rounded border border-slate-700/60 bg-slate-900 p-2.5 text-xs font-medium text-white shadow-sm">
            {proyectoLabel}
          </div>
          {data.fuente !== 'vacio' ? (
            <p className="mt-2 text-[10px] text-slate-500">Fuente: {data.fuente}</p>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <span className="block px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Capítulos
          </span>
          {data.capitulos.map((cap) => (
            <button
              key={cap.id}
              type="button"
              onClick={() => {
                setCapituloActivo(cap.id);
                const primeras = data.partidasByCapitulo[cap.id] ?? [];
                if (primeras.length > 0) setPartidaSeleccionada(primeras[0].id);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-xs font-medium transition-all ${
                capituloActivo === cap.id
                  ? 'bg-blue-600 font-semibold text-white shadow-md shadow-blue-900/20'
                  : 'hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <div className="flex min-w-0 items-center space-x-2.5">
                <FolderOpen
                  className={`h-4 w-4 shrink-0 ${capituloActivo === cap.id ? 'text-white' : 'text-slate-400'}`}
                />
                <span className="truncate">
                  {cap.numCap > 0 && cap.numCap < 9999 ? `${cap.numCap}. ` : ''}
                  {cap.nombre}
                </span>
              </div>
              {capituloActivo === cap.id ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              ) : null}
            </button>
          ))}
        </nav>
      </aside>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              title={sidebarOpen ? 'Ocultar capítulos' : 'Mostrar capítulos'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span>Presupuesto</span>
              <span>/</span>
              <span className="font-medium text-slate-800">Análisis de Precios</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.fuente === 'cascada' && partidaInfo ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void guardarApu()}
                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Guardar APU
              </button>
            ) : null}
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
              USD ($)
            </span>
          </div>
        </header>
        {saveMsg ? (
          <p
            className={`border-b px-4 py-1.5 text-xs ${saveMsg.includes('guardados') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
          >
            {saveMsg}
          </p>
        ) : null}

        <div className="flex-1 space-y-6 overflow-y-auto bg-white p-4 md:p-6">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Partidas del capítulo
                </h2>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {partidas.length} partidas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="w-32 p-3">Código Lulo</th>
                    <th className="p-3">Descripción</th>
                    <th className="w-20 p-3 text-center">Unidad</th>
                    <th className="w-24 p-3 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partidas.map((partida) => (
                    <tr
                      key={partida.id}
                      onClick={() => setPartidaSeleccionada(partida.id)}
                      className={`cursor-pointer transition-colors ${
                        partidaSeleccionada === partida.id
                          ? 'border-l-4 border-l-blue-600 bg-blue-50/70 font-medium text-blue-900'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-900">{partida.codigo}</td>
                      <td className="line-clamp-2 p-3 md:line-clamp-none">{partida.descripcion}</td>
                      <td className="p-3 text-center font-medium">{partida.unidad}</td>
                      <td className="p-3 text-right font-mono text-slate-900">
                        {partida.cantidad.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {partidaInfo ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
              <div className="bg-gradient-to-r from-slate-800 to-slate-950 p-5 text-white">
                <div className="mb-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                      Ficha APU
                    </span>
                    <h3 className="mt-1 font-mono text-sm text-slate-300">{partidaInfo.codigo}</h3>
                  </div>
                  <div className="flex gap-4 rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-xs backdrop-blur-sm">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400">Rendimiento</span>
                      <input
                        type="number"
                        min={0.0001}
                        step="any"
                        value={rendimiento}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!partidaInfo || !Number.isFinite(v) || v <= 0) return;
                          setRendOverrides((prev) => ({ ...prev, [partidaInfo.id]: v }));
                          setSaveMsg(null);
                        }}
                        className="mt-0.5 w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 font-mono text-sm font-bold text-yellow-400"
                      />
                      <span className="ml-1 text-[10px] text-slate-400">{partidaInfo.unidad}/día</span>
                    </div>
                    <div className="w-px bg-slate-700" />
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400">Unidad</span>
                      <span className="font-bold">{partidaInfo.unidad}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-200">{partidaInfo.descripcion}</p>
              </div>

              <div className="space-y-6 bg-white p-5">
                {apuPartidaVacio(apuBase) ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    Sin composición APU para <strong>{partidaInfo.codigo}</strong>. Ejecuta{' '}
                    <code className="rounded bg-amber-100 px-1">npm run import:lulo-csv</code> con
                    catálogo maestro o revisa que existan líneas en ObraPainMate / ObraPainMano /
                    ObraPainEqui.
                  </p>
                ) : null}
                <ApuMaterialesTable
                  items={apu.materiales}
                  total={calc.totalMateriales}
                  editable
                  onChangeCantidad={(idx, cantidad) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const materiales = [...prev.materiales];
                      materiales[idx] = { ...materiales[idx], cantidad };
                      return { ...prev, materiales };
                    });
                  }}
                  onChangePrecio={(idx, precio) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const materiales = [...prev.materiales];
                      materiales[idx] = { ...materiales[idx], precio };
                      return { ...prev, materiales };
                    });
                  }}
                />
                <ApuEquiposTable
                  items={apu.equipos}
                  rendimiento={rendimiento}
                  herramientaMenorDiaria={calc.herramientaMenorDiaria}
                  costoUnitarioEquipos={calc.costoUnitarioEquipos}
                  editable
                  onChangeCantidad={(idx, cantidad) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const equipos = [...prev.equipos];
                      equipos[idx] = { ...equipos[idx], cantidad };
                      return { ...prev, equipos };
                    });
                  }}
                  onChangeTarifa={(idx, tarifa) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const equipos = [...prev.equipos];
                      equipos[idx] = { ...equipos[idx], tarifa };
                      return { ...prev, equipos };
                    });
                  }}
                />
                <ApuManoObraTable
                  items={apu.manoObra}
                  config={config}
                  calc={calc}
                  costoUnitarioManoObra={calc.costoUnitarioManoObra}
                  editable
                  onChangeCantidad={(idx, cantidad) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const manoObra = [...prev.manoObra];
                      manoObra[idx] = { ...manoObra[idx], cantidad };
                      return { ...prev, manoObra };
                    });
                  }}
                  onChangeSalario={(idx, salario) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const manoObra = [...prev.manoObra];
                      manoObra[idx] = { ...manoObra[idx], salario };
                      return { ...prev, manoObra };
                    });
                  }}
                  onChangeBono={(idx, bono) => {
                    if (!partidaInfo) return;
                    patchApu(partidaInfo.id, (prev) => {
                      const manoObra = [...prev.manoObra];
                      manoObra[idx] = { ...manoObra[idx], bono };
                      return { ...prev, manoObra };
                    });
                  }}
                />

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Costo directo unitario:</span>
                      <span className="font-mono font-medium">
                        ${calc.costoDirectoUnitario.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Administración ({config.gastosAdministrativos}%):</span>
                      <span className="font-mono">${calc.montoAdmin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Utilidad ({config.utilidad}%):</span>
                      <span className="font-mono">${calc.montoUtilidad.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-lg bg-blue-600 p-4 text-white shadow-inner">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest opacity-80">
                      <Calculator className="h-3.5 w-3.5" /> Precio unitario
                    </span>
                    <span className="mt-1 font-mono text-2xl font-bold">
                      ${calc.precioUnitarioFinal.toFixed(2)}
                    </span>
                    <span className="mt-1 text-[10px] opacity-70">
                      Por cada {partidaInfo.unidad}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      step="any"
      value={value}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      className={`w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-right font-mono text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 ${className}`}
    />
  );
}

function ApuMaterialesTable({
  items,
  total,
  editable = false,
  onChangeCantidad,
  onChangePrecio,
}: {
  items: LuloWebErpApuPartida['materiales'];
  total: number;
  editable?: boolean;
  onChangeCantidad?: (index: number, cantidad: number) => void;
  onChangePrecio?: (index: number, precio: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
        <Package className="h-4 w-4 text-sky-600" />
        <h4>1. Materiales</h4>
      </div>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
            <th className="w-24 p-2.5">Código</th>
            <th className="p-2.5">Descripción</th>
            <th className="w-20 p-2.5 text-center">Unidad</th>
            <th className="w-24 p-2.5 text-right">Cantidad</th>
            <th className="w-24 p-2.5 text-right">Precio</th>
            <th className="w-28 p-2.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
          {items.map((m, i) => (
            <tr key={`${m.codigo}-${i}`} className="hover:bg-slate-50/50">
              <td className="p-2.5 font-mono text-slate-400">{m.codigo}</td>
              <td className="p-2.5 font-medium text-slate-800">{m.descripcion}</td>
              <td className="p-2.5 text-center">{m.unidad}</td>
              <td className="p-2.5 text-right">
                {editable && onChangeCantidad ? (
                  <NumInput value={m.cantidad} onChange={(v) => onChangeCantidad(i, v)} />
                ) : (
                  <span className="font-mono">{m.cantidad}</span>
                )}
              </td>
              <td className="p-2.5 text-right">
                {editable && onChangePrecio ? (
                  <NumInput value={m.precio} onChange={(v) => onChangePrecio(i, v)} />
                ) : (
                  <span className="font-mono">{m.precio.toFixed(2)}</span>
                )}
              </td>
              <td className="p-2.5 text-right font-mono font-medium text-slate-900">
                {(m.cantidad * m.precio).toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50/80 font-semibold text-slate-700">
            <td colSpan={5} className="p-2.5 text-right text-[10px] uppercase">
              Sub-total materiales:
            </td>
            <td className="p-2.5 text-right font-mono text-sm">${total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ApuEquiposTable({
  items,
  rendimiento,
  herramientaMenorDiaria,
  costoUnitarioEquipos,
  editable = false,
  onChangeCantidad,
  onChangeTarifa,
}: {
  items: LuloWebErpApuPartida['equipos'];
  rendimiento: number;
  herramientaMenorDiaria: number;
  costoUnitarioEquipos: number;
  editable?: boolean;
  onChangeCantidad?: (index: number, cantidad: number) => void;
  onChangeTarifa?: (index: number, tarifa: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
        <Wrench className="h-4 w-4 text-amber-600" />
        <h4>2. Equipos</h4>
      </div>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
            <th className="w-24 p-2.5">Código</th>
            <th className="p-2.5">Descripción</th>
            <th className="w-20 p-2.5 text-center">Cant.</th>
            <th className="w-24 p-2.5 text-right">Tarifa diaria</th>
            <th className="w-24 p-2.5 text-right">Costo diario</th>
            <th className="w-28 p-2.5 text-right">Costo unit.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
          {items.map((e, i) => {
            const costoDiario = e.esPorcentajeManoObra
              ? herramientaMenorDiaria
              : e.cantidad * e.tarifa;
            const costoUnit = costoDiario / rendimiento;
            return (
              <tr key={`${e.codigo}-${i}`} className="hover:bg-slate-50/50">
                <td className="p-2.5 font-mono text-slate-400">{e.codigo}</td>
                <td className="p-2.5 font-medium text-slate-800">
                  {e.descripcion}
                  {e.esPorcentajeManoObra ? (
                    <span className="ml-1 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-semibold text-blue-600">
                      Auto
                    </span>
                  ) : null}
                </td>
                <td className="p-2.5 text-center">
                  {editable && onChangeCantidad && !e.esPorcentajeManoObra ? (
                    <NumInput value={e.cantidad} onChange={(v) => onChangeCantidad(i, v)} />
                  ) : (
                    <span className="font-mono">{e.cantidad}</span>
                  )}
                </td>
                <td className="p-2.5 text-right">
                  {e.esPorcentajeManoObra ? (
                    '—'
                  ) : editable && onChangeTarifa ? (
                    <NumInput value={e.tarifa} onChange={(v) => onChangeTarifa(i, v)} />
                  ) : (
                    <span className="font-mono">{e.tarifa.toFixed(2)}</span>
                  )}
                </td>
                <td className="p-2.5 text-right font-mono">{costoDiario.toFixed(2)}</td>
                <td className="p-2.5 text-right font-mono text-slate-900">
                  {costoUnit.toFixed(2)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-slate-50/80 font-semibold text-slate-700">
            <td colSpan={5} className="p-2.5 text-right text-[10px] uppercase">
              Sub-total equipos (diario / rendimiento):
            </td>
            <td className="p-2.5 text-right font-mono text-sm">
              ${costoUnitarioEquipos.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ApuManoObraTable({
  items,
  config,
  calc,
  costoUnitarioManoObra,
  editable = false,
  onChangeCantidad,
  onChangeSalario,
  onChangeBono,
}: {
  items: LuloWebErpApuPartida['manoObra'];
  config: LuloWebErpPayload['config'];
  calc: ReturnType<typeof calcularApuLuloWin>;
  costoUnitarioManoObra: number;
  editable?: boolean;
  onChangeCantidad?: (index: number, cantidad: number) => void;
  onChangeSalario?: (index: number, salario: number) => void;
  onChangeBono?: (index: number, bono: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
        <HardHat className="h-4 w-4 text-emerald-600" />
        <h4>3. Mano de obra</h4>
      </div>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
            <th className="w-24 p-2.5">Código</th>
            <th className="p-2.5">Personal</th>
            <th className="w-20 p-2.5 text-center">Cant.</th>
            <th className="w-24 p-2.5 text-right">Salario</th>
            <th className="w-24 p-2.5 text-right">Bono</th>
            <th className="w-28 p-2.5 text-right">Total diario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
          {items.map((mo, i) => {
            const diario = mo.cantidad * mo.salario + mo.cantidad * mo.bono;
            return (
              <tr key={`${mo.codigo}-${i}`} className="hover:bg-slate-50/50">
                <td className="p-2.5 font-mono text-slate-400">{mo.codigo}</td>
                <td className="p-2.5 font-medium text-slate-800">{mo.descripcion}</td>
                <td className="p-2.5 text-center">
                  {editable && onChangeCantidad ? (
                    <NumInput value={mo.cantidad} onChange={(v) => onChangeCantidad(i, v)} />
                  ) : (
                    <span className="font-mono">{mo.cantidad}</span>
                  )}
                </td>
                <td className="p-2.5 text-right">
                  {editable && onChangeSalario ? (
                    <NumInput value={mo.salario} onChange={(v) => onChangeSalario(i, v)} />
                  ) : (
                    <span className="font-mono">{mo.salario.toFixed(2)}</span>
                  )}
                </td>
                <td className="p-2.5 text-right">
                  {editable && onChangeBono ? (
                    <NumInput value={mo.bono} onChange={(v) => onChangeBono(i, v)} />
                  ) : (
                    <span className="font-mono">{mo.bono.toFixed(2)}</span>
                  )}
                </td>
                <td className="p-2.5 text-right font-mono text-slate-900">{diario.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr className="font-medium text-slate-500">
            <td colSpan={5} className="p-2 text-right text-[11px]">
              Total salarios directos diarios:
            </td>
            <td className="p-2 text-right font-mono">${calc.totalSalariosDiarios.toFixed(2)}</td>
          </tr>
          <tr className="font-medium text-slate-500">
            <td colSpan={5} className="p-2 text-right text-[11px]">
              Prestaciones sociales ({config.prestacionesSociales}%):
            </td>
            <td className="p-2 text-right font-mono">${calc.costoPrestaciones.toFixed(2)}</td>
          </tr>
          <tr className="font-medium text-slate-500">
            <td colSpan={5} className="p-2 text-right text-[11px]">
              Total bonificaciones diarias:
            </td>
            <td className="p-2 text-right font-mono">${calc.totalBonosDiarios.toFixed(2)}</td>
          </tr>
          <tr className="bg-slate-50/80 font-semibold text-slate-700">
            <td colSpan={5} className="p-2.5 text-right text-[10px] uppercase">
              Sub-total MO (diario / rendimiento):
            </td>
            <td className="p-2.5 text-right font-mono text-sm">
              ${costoUnitarioManoObra.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
