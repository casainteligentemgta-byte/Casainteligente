'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  emptyHojaVidaObreroCompleta,
  hojaVidaDesdeRow,
  nombreCompletoDesde,
} from '@/lib/talento/hojaVidaObreroCompleta';

const HojaVidaObreroVista = dynamic(() => import('@/components/talento/HojaVidaObreroVista'), {
  ssr: false,
});

export default function BancaHojaVidaDetallePage() {
  const params = useParams();
  const id = String(params.id ?? '').trim();
  const supabase = useMemo(() => createClient(), []);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError('Falta el expediente.');
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      setLoading(true);
      if (process.env.NODE_ENV === 'development' && id === '00000000-0000-0000-0000-000000000001') {
        const demo = emptyHojaVidaObreroCompleta();
        demo.datosPersonales.primerNombre = 'Luis';
        demo.datosPersonales.segundoNombre = 'Vicente';
        demo.datosPersonales.primerApellido = 'Mata';
        demo.datosPersonales.segundoApellido = 'Ortiz';
        demo.datosPersonales.cedulaIdentidad = 'V-13348186';
        demo.datosPersonales.fechaNacimiento = '1988-04-12';
        demo.datosPersonales.edad = '38';
        demo.datosPersonales.estadoCivil = 'Casado/a';
        demo.datosPersonales.nacionalidad = 'Venezolana';
        demo.datosPersonales.paisNacimiento = 'Venezuela';
        demo.datosPersonales.lugarNacimiento = 'Nueva Esparta';
        demo.datosPersonales.celular = '04141234567';
        demo.datosPersonales.telHabitacion = '0295-5551234';
        demo.datosPersonales.correoElectronico = 'luis@example.com';
        demo.datosPersonales.direccionDomicilio = 'Calle Principal, Porlamar';
        demo.datosPersonales.inscripcionIvss = 'si';
        demo.datosPersonales.zurdo = 'no';
        demo.instruccionCapacitacion.sabeLeer = 'si';
        demo.instruccionCapacitacion.instruccionSecundaria = true;
        demo.familiaresDependientes[0] = {
          nombre: 'Ana',
          apellido: 'Mata',
          parentesco: 'Cónyuge',
          fechaNacimiento: '1990-01-01',
          noAplica: false,
          observaciones: '',
        };
        demo.trabajosPrevios[0] = {
          empresaPatrono: 'Constructora Sur',
          lugar: 'Margarita',
          oficioOCargo: 'Ayudante',
          duracion: '2 años',
          fechaRetiro: '2024-06-01',
          motivoRetiro: 'Fin de obra',
        };
        setRow({
          id,
          nombre_completo: 'Mata Ortiz, Luis Vicente',
          cedula: 'V-13348186',
          hoja_vida_obrero: demo,
        });
        setError(null);
        setLoading(false);
        return;
      }
      const { data, error: qErr } = await supabase.from('ci_empleados').select('*').eq('id', id).maybeSingle();
      if (!alive) return;
      if (qErr) {
        setError(qErr.message);
        setRow(null);
        setLoading(false);
        return;
      }
      if (!data) {
        setError('No se encontró el expediente.');
        setRow(null);
        setLoading(false);
        return;
      }
      setRow(data as Record<string, unknown>);
      setError(null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  const hoja = useMemo(() => (row ? hojaVidaDesdeRow(row) : null), [row]);
  const nombre = hoja ? nombreCompletoDesde(hoja).trim() || String(row?.nombre_completo ?? '').trim() : '';
  const cedula = hoja
    ? hoja.datosPersonales.cedulaIdentidad.trim() || String(row?.cedula ?? row?.documento ?? '').trim()
    : '';
  const pdfHref =
    id && cedula
      ? `/registro/planilla?empleadoId=${encodeURIComponent(id)}&cedula=${encodeURIComponent(cedula)}&tipo=hoja_vida&volver=${encodeURIComponent(`/rrhh/hojas-vida/archivo/${id}`)}`
      : '';

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 pb-24 pt-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/rrhh/hojas-vida/archivo"
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Banca de obreros
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Hoja de vida</h1>
            {nombre ? <p className="mt-1 text-sm text-zinc-400">{nombre}</p> : null}
          </div>
          {pdfHref ? (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10"
            >
              <FileText className="h-4 w-4 opacity-70" />
              Abrir PDF
            </a>
          ) : null}
        </header>

        {loading ? <p className="text-sm text-zinc-500">Cargando hoja de vida…</p> : null}
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}
        {!loading && !error && hoja ? (
          <HojaVidaObreroVista hojaVidaLegal={hoja} documentVariant="hoja_vida" tamano="ampliado" />
        ) : null}
      </div>
    </div>
  );
}
