'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Camera, Plus, Ruler, Trash2, Upload, X } from 'lucide-react';
import {
  type CamaraPlano,
  type EscalaPlano,
  type Punto2D,
  ALCANCE_MAX_M,
  ALCANCE_MIN_M,
  FOV_LADO_MAX_DEG,
  FOV_LADO_MIN_DEG,
  FOV_MAX_DEG,
  FOV_MIN_DEG,
  FOV_PRESETS_DEG,
  alcanceMaxPx,
  alcanceMinPx,
  calcularEscala,
  cargarCamarasLocal,
  cargarEscalaLocal,
  clampFov,
  espectroStorageIds,
  formatDistancia,
  fovDesdeLados,
  fovSimetrico,
  guardarCamarasLocal,
  guardarEscalaLocal,
  ladosFov,
  metrosAPx,
  normalizarCamara,
  nuevaCamara,
  pxAMetros,
} from '@/lib/proyectos/espectroCamara';
import {
  cameraCatalog,
  defaultLensKey,
  findCameraModel,
  fovTeorico,
  lensKeys,
} from '@/lib/proyectos/cameraCatalog';
import {
  esPdfFile,
  esPdfUrl,
  pdfSourceToDataUrl,
} from '@/lib/proyectos/pdfPlanoAImagen';

const EspectroCamaraCanvas = dynamic(() => import('@/components/proyectos/EspectroCamaraCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-white/10 bg-[#111118] text-xs text-zinc-500">
      Cargando lienzo…
    </div>
  ),
});

type Props = {
  proyectoId?: string;
  planoId?: string;
  planoNombre?: string;
  /** URL de imagen o PDF del plano (el PDF se rasteriza en el cliente). */
  backgroundUrl?: string | null;
  className?: string;
  /** Alto del Stage; el ancho se mide del contenedor. */
  canvasHeight?: number;
};

function LienzoPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-white/10 bg-[#111118] text-xs text-zinc-500"
      style={{ height }}
    >
      Cargando lienzo…
    </div>
  );
}

export default function EspectroCamaraPanel({
  proyectoId,
  planoId,
  planoNombre,
  backgroundUrl: backgroundUrlProp = null,
  className = '',
  canvasHeight = 480,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [width, setWidth] = useState(600);
  const [camaras, setCamaras] = useState<CamaraPlano[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bgOverride, setBgOverride] = useState<string | null>(null);
  const [resolvedBg, setResolvedBg] = useState<string | null>(null);
  const [bgStatus, setBgStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [hydrated, setHydrated] = useState(false);
  const [escala, setEscala] = useState<EscalaPlano | null>(null);
  const [calibrando, setCalibrando] = useState(false);
  const [puntosCalibracion, setPuntosCalibracion] = useState<Punto2D[]>([]);
  const [metrosRefInput, setMetrosRefInput] = useState('5');

  const storageIds = useMemo(
    () => espectroStorageIds(proyectoId, planoId),
    [proyectoId, planoId],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    const source = bgOverride || backgroundUrlProp;

    async function resolveBg() {
      if (!source) {
        setResolvedBg(null);
        setBgStatus('idle');
        return;
      }

      if (bgOverride) {
        setResolvedBg(bgOverride);
        return;
      }

      if (source.startsWith('data:image/')) {
        setResolvedBg(source);
        return;
      }

      if (esPdfUrl(source)) {
        setBgStatus('loading');
        try {
          const dataUrl = await pdfSourceToDataUrl(source);
          if (!cancelled) {
            setResolvedBg(dataUrl);
            setBgStatus('ok');
          }
        } catch {
          if (!cancelled) {
            setResolvedBg(null);
            setBgStatus('error');
          }
        }
        return;
      }

      setResolvedBg(source);
    }

    void resolveBg();
    return () => {
      cancelled = true;
    };
  }, [mounted, bgOverride, backgroundUrlProp]);

  useEffect(() => {
    if (!mounted) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth) || 600);
    return () => ro.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const { proyectoId: pid, planoId: plid } = storageIds;
    const loaded = cargarCamarasLocal(pid, plid).map(normalizarCamara);
    setCamaras(loaded.length ? loaded : [nuevaCamara({ x: 220, y: 220, label: 'CAM-01' })]);
    setEscala(cargarEscalaLocal(pid, plid));
    setSelectedId(null);
    setCalibrando(false);
    setPuntosCalibracion([]);
    setHydrated(true);
  }, [mounted, storageIds]);

  useEffect(() => {
    if (!mounted || !hydrated) return;
    const { proyectoId: pid, planoId: plid } = storageIds;
    guardarCamarasLocal(pid, plid, camaras);
  }, [camaras, hydrated, mounted, storageIds]);

  useEffect(() => {
    if (!mounted || !hydrated) return;
    const { proyectoId: pid, planoId: plid } = storageIds;
    guardarEscalaLocal(pid, plid, escala);
  }, [escala, hydrated, mounted, storageIds]);

  const selected = useMemo(
    () => camaras.find((c) => c.id === selectedId) ?? null,
    [camaras, selectedId],
  );

  const selectedModel = useMemo(
    () => findCameraModel(selected?.catalogId),
    [selected?.catalogId],
  );

  const selectedLenses = useMemo(
    () => (selectedModel ? lensKeys(selectedModel) : []),
    [selectedModel],
  );

  const patchCamara = (id: string, patch: Partial<CamaraPlano>) => {
    setCamaras((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const merged = { ...c, ...patch };
        if (
          typeof patch.angleLeft === 'number' ||
          typeof patch.angleRight === 'number'
        ) {
          return {
            ...merged,
            ...fovDesdeLados(
              patch.angleLeft ?? merged.angleLeft,
              patch.angleRight ?? merged.angleRight,
            ),
          };
        }
        if (typeof patch.angle === 'number') {
          return { ...merged, ...fovSimetrico(clampFov(patch.angle)) };
        }
        return merged;
      }),
    );
  };

  const handleLensChange = (camaraId: string, selectedLens: string) => {
    const cam = camaras.find((c) => c.id === camaraId);
    const model = findCameraModel(cam?.catalogId);
    if (!cam || !model) return;
    const angle = model.lenses[selectedLens];
    if (typeof angle !== 'number') return;
    patchCamara(camaraId, {
      lensKey: selectedLens,
      ...fovSimetrico(angle),
      brand: model.brand,
      modelName: model.model,
    });
  };

  const handleModelChange = (camaraId: string, catalogId: string) => {
    const model = findCameraModel(catalogId);
    if (!model) return;
    const lens = defaultLensKey(model);
    const angle = model.lenses[lens];
    if (typeof angle !== 'number') return;
    patchCamara(camaraId, {
      catalogId,
      lensKey: lens,
      ...fovSimetrico(angle),
      brand: model.brand,
      modelName: model.model,
    });
  };

  const addCamara = () => {
    const n = camaras.length + 1;
    const defaultRadius = escala
      ? Math.min(alcanceMaxPx(escala), Math.max(alcanceMinPx(escala), metrosAPx(2.5, escala)))
      : 80;
    const c = nuevaCamara({
      x: 120 + (n % 5) * 40,
      y: 120 + (n % 4) * 40,
      label: `CAM-${String(n).padStart(2, '0')}`,
      radius: defaultRadius,
    });
    setCamaras((prev) => [...prev, c]);
    setSelectedId(c.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setCamaras((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  };

  const startCalibracion = () => {
    setCalibrando(true);
    setPuntosCalibracion([]);
    setSelectedId(null);
    setMetrosRefInput(escala ? String(escala.metrosReferencia) : '5');
  };

  const cancelCalibracion = () => {
    setCalibrando(false);
    setPuntosCalibracion([]);
  };

  const onCalibracionClick = (punto: Punto2D) => {
    setPuntosCalibracion((prev) => {
      if (prev.length >= 2) return [punto];
      return [...prev, punto];
    });
  };

  const confirmarEscala = () => {
    if (puntosCalibracion.length < 2) return;
    const metros = Number(metrosRefInput.replace(',', '.'));
    const next = calcularEscala(puntosCalibracion[0]!, puntosCalibracion[1]!, metros);
    if (!next) return;
    setEscala(next);
    setCalibrando(false);
    setPuntosCalibracion([]);
  };

  const borrarEscala = () => {
    setEscala(null);
    cancelCalibracion();
  };

  const onBgFile = (file: File | null) => {
    if (bgOverride?.startsWith('blob:')) URL.revokeObjectURL(bgOverride);
    if (!file) {
      setBgOverride(null);
      setBgStatus('idle');
      return;
    }

    setBgStatus('loading');

    void (async () => {
      try {
        if (esPdfFile(file)) {
          const dataUrl = await pdfSourceToDataUrl(await file.arrayBuffer());
          setBgOverride(dataUrl);
          setBgStatus('ok');
          return;
        }
        if (file.type.startsWith('image/')) {
          setBgOverride(URL.createObjectURL(file));
          return;
        }
        setBgStatus('error');
      } catch {
        setBgOverride(null);
        setBgStatus('error');
      }
    })();
  };

  const teoricoHint =
    selectedModel && selected?.lensKey
      ? fovTeorico(selectedModel.sensorSizeHorizontal, parseFloat(selected.lensKey) || 0)
      : null;

  const alcanceM = selected && escala ? pxAMetros(selected.radius, escala) : null;
  const minPx = alcanceMinPx(escala);
  const maxPx = alcanceMaxPx(escala);
  const ladosSelected = selected ? ladosFov(selected) : null;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <Camera className="h-3.5 w-3.5 text-emerald-400" />
            NetVision PRO
            {planoNombre ? <span className="font-normal text-zinc-500">· {planoNombre}</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {calibrando
              ? puntosCalibracion.length === 0
                ? 'Haz clic en el primer extremo de una cota conocida del plano.'
                : puntosCalibracion.length === 1
                  ? 'Haz clic en el segundo extremo de la misma cota.'
                  : 'Indica abajo la distancia real (m) y confirma la escala.'
              : escala
                ? `Escala calibrada (${escala.metrosReferencia} m de referencia). Icono a escala del plano · FOV 90° / 103° / personalizado.`
                : 'Define la escala (2 puntos + metros). Luego coloca cámaras: icono en el vértice + espectro con grados.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-white/10">
            <Upload className="h-3 w-3" />
            Fondo (imagen/PDF)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                onBgFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
          {bgStatus === 'ok' ? (
            <span className="text-[10px] text-emerald-400">Fondo OK</span>
          ) : bgStatus === 'loading' ? (
            <span className="text-[10px] text-zinc-500">Cargando fondo…</span>
          ) : bgStatus === 'error' ? (
            <span className="text-[10px] text-red-400">No se pudo cargar (PNG/JPG/WebP/PDF)</span>
          ) : null}

          {!calibrando ? (
            <button
              type="button"
              onClick={startCalibracion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300 hover:bg-amber-500/20"
            >
              <Ruler className="h-3 w-3" />
              {escala ? 'Recalibrar escala' : 'Definir escala'}
            </button>
          ) : (
            <button
              type="button"
              onClick={cancelCalibracion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-white/10"
            >
              <X className="h-3 w-3" />
              Cancelar
            </button>
          )}

          {escala && !calibrando ? (
            <button
              type="button"
              onClick={borrarEscala}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-500 hover:text-red-400"
            >
              Quitar escala
            </button>
          ) : null}

          <button
            type="button"
            onClick={addCamara}
            disabled={calibrando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            Cámara
          </button>
          <button
            type="button"
            disabled={!selectedId || calibrando}
            onClick={removeSelected}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Quitar
          </button>
        </div>
      </div>

      {calibrando && puntosCalibracion.length === 2 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <label className="block text-[10px] font-bold uppercase text-amber-200/80">
            Distancia real entre los 2 puntos (m)
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={metrosRefInput}
              onChange={(e) => setMetrosRefInput(e.target.value)}
              className="mt-1 w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={confirmarEscala}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-black hover:bg-amber-400"
          >
            Confirmar escala
          </button>
        </div>
      ) : null}

      <div ref={wrapRef} className="w-full">
        {mounted ? (
          <EspectroCamaraCanvas
            width={width}
            height={canvasHeight}
            camaras={camaras}
            selectedId={selectedId}
            backgroundUrl={resolvedBg}
            escala={escala}
            calibrando={calibrando}
            puntosCalibracion={puntosCalibracion}
            onSelect={setSelectedId}
            onChange={patchCamara}
            onBackgroundStatus={setBgStatus}
            onCalibracionClick={onCalibracionClick}
          />
        ) : (
          <LienzoPlaceholder height={canvasHeight} />
        )}
      </div>

      {mounted && selected && !calibrando ? (
        <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-3">
          <label className="sm:col-span-2 block text-[10px] font-bold uppercase text-zinc-500">
            Modelo (catálogo)
            <select
              value={selected.catalogId ?? ''}
              onChange={(e) => handleModelChange(selected.id, e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
            >
              {cameraCatalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand} · {m.model}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] font-bold uppercase text-zinc-500">
            Lente
            <select
              value={selected.lensKey ?? ''}
              onChange={(e) => handleLensChange(selected.id, e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
            >
              {selectedLenses.map((k) => (
                <option key={k} value={k}>
                  {k} · {selectedModel?.lenses[k]}°
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-zinc-500">
              Espectro / FOV total:{' '}
              {(ladosSelected ? ladosSelected.left + ladosSelected.right : selected.angle).toFixed(1)}
              °
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {FOV_PRESETS_DEG.map((deg) => {
                const total = ladosSelected
                  ? ladosSelected.left + ladosSelected.right
                  : selected.angle;
                const active =
                  Math.abs(total - deg) < 0.05 &&
                  ladosSelected != null &&
                  Math.abs(ladosSelected.left - ladosSelected.right) < 0.05;
                return (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => patchCamara(selected.id, fovSimetrico(deg))}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] tabular-nums transition-colors ${
                      active
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {deg}°
                  </button>
                );
              })}
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-400">
                Total
                <input
                  type="number"
                  min={FOV_MIN_DEG}
                  max={FOV_MAX_DEG}
                  step={0.1}
                  value={Number(
                    (
                      ladosSelected
                        ? ladosSelected.left + ladosSelected.right
                        : selected.angle
                    ).toFixed(1),
                  )}
                  onChange={(e) =>
                    patchCamara(selected.id, fovSimetrico(clampFov(Number(e.target.value))))
                  }
                  className="w-16 rounded border border-white/10 bg-transparent px-1.5 py-0.5 text-xs tabular-nums text-white outline-none"
                />
                °
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-bold uppercase text-zinc-500">
                Lado izquierdo: {ladosSelected?.left.toFixed(1) ?? '—'}°
                <input
                  type="range"
                  min={FOV_LADO_MIN_DEG}
                  max={FOV_LADO_MAX_DEG}
                  step={0.1}
                  value={ladosSelected?.left ?? 45}
                  onChange={(e) =>
                    patchCamara(selected.id, {
                      angleLeft: Number(e.target.value),
                      angleRight: ladosSelected?.right ?? selected.angleRight,
                    })
                  }
                  className="mt-1 w-full accent-emerald-500"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase text-zinc-500">
                Lado derecho: {ladosSelected?.right.toFixed(1) ?? '—'}°
                <input
                  type="range"
                  min={FOV_LADO_MIN_DEG}
                  max={FOV_LADO_MAX_DEG}
                  step={0.1}
                  value={ladosSelected?.right ?? 45}
                  onChange={(e) =>
                    patchCamara(selected.id, {
                      angleLeft: ladosSelected?.left ?? selected.angleLeft,
                      angleRight: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full accent-emerald-500"
                />
              </label>
            </div>
            <p className="text-[10px] normal-case font-normal text-zinc-600">
              Arrastra cada borde del cono en el plano, o usa los sliders. Los presets 90°/103°
              dejan ambos lados iguales.
            </p>
          </div>
          <label className="block text-[10px] font-bold uppercase text-zinc-500">
            {escala && alcanceM != null
              ? `Alcance: ${formatDistancia(selected.radius, escala)}`
              : `Alcance (px): ${Math.round(selected.radius)}`}
            <input
              type="range"
              min={minPx}
              max={maxPx}
              step={escala ? Math.max(1, (maxPx - minPx) / 400) : 1}
              value={Math.min(maxPx, Math.max(minPx, selected.radius))}
              onChange={(e) => patchCamara(selected.id, { radius: Number(e.target.value) })}
              className="mt-1 w-full accent-emerald-500"
            />
            {escala ? (
              <span className="mt-1 block normal-case font-normal text-[10px] text-zinc-600">
                Rango {ALCANCE_MIN_M}–{ALCANCE_MAX_M} m (útil en rincones / pasillos)
              </span>
            ) : null}
          </label>
          <label className="block text-[10px] font-bold uppercase text-zinc-500">
            Orientación (°): {Math.round(selected.rotation)}
            <input
              type="range"
              min={-180}
              max={180}
              value={selected.rotation}
              onChange={(e) => patchCamara(selected.id, { rotation: Number(e.target.value) })}
              className="mt-1 w-full accent-emerald-500"
            />
          </label>
          <label className="sm:col-span-3 block text-[10px] font-bold uppercase text-zinc-500">
            Etiqueta
            <input
              value={selected.label ?? ''}
              onChange={(e) => patchCamara(selected.id, { label: e.target.value })}
              placeholder="CAM-01"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
            />
          </label>
          <p className="sm:col-span-3 text-[10px] text-zinc-600">
            FOV del fabricante
            {selectedModel && selected.lensKey
              ? `: ${selectedModel.lenses[selected.lensKey] ?? '—'}°`
              : ''}
            {teoricoHint != null && teoricoHint > 0
              ? ` · teórico sensor ${selectedModel!.sensorSizeHorizontal} mm / ${selected.lensKey}: ${teoricoHint.toFixed(1)}°`
              : ''}
            . Escala y cámaras se guardan en este navegador.
          </p>
        </div>
      ) : mounted && !calibrando ? (
        <p className="text-[11px] text-zinc-500">
          Selecciona una cámara para ajustar cada lado del espectro (izq./der.) o usar presets 90° /
          103°.
        </p>
      ) : null}
    </div>
  );
}
