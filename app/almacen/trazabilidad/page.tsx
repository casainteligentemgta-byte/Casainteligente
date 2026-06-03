'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Route } from 'lucide-react';
import MaterialJourneyTimeline from '@/components/almacen/MaterialJourneyTimeline';
import { fetchTrayectoriaDetalle } from '@/lib/almacen/fetchTrayectoriaMaterial';
import type { MovimientoJourney } from '@/lib/almacen/trazabilidadMaterial';

export default function TrazabilidadMaterialPage() {
  const searchParams = useSearchParams();
  const materialId = searchParams.get('materialId')?.trim() ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoJourney[]>([]);
  const [materialNombre, setMaterialNombre] = useState<string | undefined>();
  const [materialCodigo, setMaterialCodigo] = useState<string | null | undefined>();

  const cargar = useCallback(async () => {
    if (!materialId) {
      setMovimientos([]);
      setError('Indique materialId en la URL, por ejemplo /almacen/trazabilidad?materialId=uuid');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { movimientos, material } = await fetchTrayectoriaDetalle(materialId);
      setMovimientos(movimientos);
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

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/almacen">
            <button
              type="button"
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"
              aria-label="Volver al almacén"
            >
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
              <Route className="text-[#FF9500]" size={28} />
              Trazabilidad
            </h1>
            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">
              Ruta del material en inventario
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
            <Loader2 className="animate-spin text-[#FF9500]" size={22} />
            Cargando trayectoria…
          </div>
        ) : (
          <MaterialJourneyTimeline
            movimientos={movimientos}
            materialNombre={materialNombre}
            materialCodigo={materialCodigo}
          />
        )}
      </div>
    </div>
  );
}
