'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import MaterialJourneyTimeline from '@/components/almacen/MaterialJourneyTimeline';
import { fetchTrayectoriaDetalle } from '@/lib/almacen/fetchTrayectoriaMaterial';
import type { MovimientoJourney } from '@/lib/almacen/trazabilidadMaterial';

type Props = {
  materialId: string;
  titulo?: string;
  subtitulo?: string;
};

/**
 * Bloque listo para páginas de detalle del producto:
 * carga trayectoria y renderiza MaterialJourneyTimeline.
 */
export default function MaterialTrayectoriaSection({
  materialId,
  titulo,
  subtitulo,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoJourney[]>([]);
  const [materialNombre, setMaterialNombre] = useState<string | undefined>();
  const [materialCodigo, setMaterialCodigo] = useState<string | null | undefined>();

  const cargar = useCallback(async () => {
    const mid = materialId.trim();
    if (!mid) {
      setMovimientos([]);
      setError('Falta materialId');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { movimientos: m, material } = await fetchTrayectoriaDetalle(mid);
      setMovimientos(m);
      setMaterialNombre(material?.nombre);
      setMaterialCodigo(material?.codigo ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
        <Loader2 className="animate-spin text-[#FF9500]" size={22} />
        Cargando trayectoria…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    );
  }

  return (
    <MaterialJourneyTimeline
      movimientos={movimientos}
      titulo={titulo}
      subtitulo={subtitulo}
      materialNombre={materialNombre}
      materialCodigo={materialCodigo}
    />
  );
}
