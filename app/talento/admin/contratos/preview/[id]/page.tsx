'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, StyleSheet, Text, pdf } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/client';

type ContratoPayload = {
  id: string;
  empleado: { nombre: string; cedula: string; direccion: string };
  proyecto: { nombre: string; ubicacion: string; duracion_estimada: string };
  contrato: {
    cargo: string;
    nivel: number;
    salario_diario: string;
    bono_asistencia: string;
    fecha_inicio: string;
    monto_acordado_usd: number;
    porcentaje_inicial: number;
    texto_legal: string;
  };
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, lineHeight: 1.5, color: '#0f172a' },
  title: { fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 10, textAlign: 'center', marginBottom: 14 },
  p: { marginBottom: 8 },
});

function ContratoPdf({ data }: { data: ContratoPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CASA INTELIGENTE</Text>
        <Text style={styles.subtitle}>Contrato Individual de Trabajo para Obra Determinada</Text>
        <Text style={styles.p}>
          Entre CASA INTELIGENTE C.A. y el trabajador {data.empleado.nombre}, CI {data.empleado.cedula}, se celebra
          contrato para el proyecto "{data.proyecto.nombre}" ubicado en {data.proyecto.ubicacion}.
        </Text>
        <Text style={styles.p}>
          Cargo: {data.contrato.cargo} (Nivel {data.contrato.nivel}). Duración estimada: {data.proyecto.duracion_estimada}.
        </Text>
        <Text style={styles.p}>
          Salario diario: {data.contrato.salario_diario} VES. Bono asistencia diario: {data.contrato.bono_asistencia} VES.
        </Text>
        <Text style={styles.p}>
          Monto acordado obra: {data.contrato.monto_acordado_usd.toFixed(2)} USD. Inicial: {data.contrato.porcentaje_inicial}%.
        </Text>
        <Text style={styles.p}>Fecha de inicio: {data.contrato.fecha_inicio}</Text>
      </Page>
    </Document>
  );
}

export default function ContratoPreview({ params }: { params: { id: string } }) {
  const componenteRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<ContratoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/talento/contratos/${params.id}`)
      .then(async (r) => {
        const body = (await r.json()) as ContratoPayload & { error?: string };
        if (!r.ok) throw new Error(body.error ?? 'No se pudo cargar contrato.');
        if (!cancelled) setData(body);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleImprimirPDF = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await pdf(<ContratoPdf data={data} />).toBlob();
      const path = `contratos/${data.id}/contrato-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from('ci-talento-media').upload(path, blob, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (upErr) {
        setError(upErr.message);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from('ci-talento-media').getPublicUrl(path);
      setPdfUrl(pub.publicUrl);
      window.print();
    } catch {
      setError('No se pudo generar o subir el PDF.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-8 text-sm text-slate-600">Cargando contrato...</div>;
  }
  if (error || !data) {
    return <div className="min-h-screen bg-slate-100 p-8 text-sm text-red-600">{error ?? 'Contrato no disponible.'}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100 p-8 pb-24 font-sans">
      <div className="mb-6 flex w-full max-w-4xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Previsualizacion de Contrato</h1>
          <p className="text-sm text-slate-500">Borrador autogenerado por Gemini IA</p>
        </div>
        <button
          onClick={handleImprimirPDF}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 font-bold text-white shadow-md transition-all hover:bg-blue-700"
        >
          {saving ? 'Emitiendo PDF...' : 'Emitir PDF y Solicitar Firma'}
        </button>
      </div>
      {pdfUrl ? (
        <div className="mb-4 w-full max-w-4xl rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          PDF emitido:
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="ml-2 underline">
            Abrir documento
          </a>
        </div>
      ) : null}
      {error ? <p className="mb-4 w-full max-w-4xl text-sm text-red-600">{error}</p> : null}

      <div
        ref={componenteRef}
        className="w-full max-w-4xl rounded-sm border border-slate-200 bg-white p-16 text-justify leading-relaxed text-slate-900 shadow-2xl"
        style={{ minHeight: '297mm' }}
      >
        <div className="mb-8 border-b-2 border-slate-800 pb-4 text-center">
          <h2 className="text-3xl font-black tracking-tighter">CASA INTELIGENTE</h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-slate-600">
            Contrato Individual de Trabajo para Obra Determinada
          </p>
        </div>

        <div className="space-y-6 text-sm">
          <p>
            Entre la sociedad mercantil <strong>CASA INTELIGENTE C.A.</strong>, domiciliada en la Republica
            Bolivariana de Venezuela, en lo sucesivo denominada "EL PATRONO", y por la otra parte el ciudadano{' '}
            <strong>{data.empleado.nombre}</strong>, titular de la Cedula de Identidad Nro.{' '}
            <strong>{data.empleado.cedula}</strong>, domiciliado en <strong>{data.empleado.direccion}</strong>, en lo
            sucesivo denominado "EL TRABAJADOR", se ha convenido en celebrar el presente Contrato de Trabajo, el cual
            se regira por las siguientes clausulas:
          </p>

          <p>
            <strong>PRIMERA (DEL OBJETO Y LUGAR):</strong> EL TRABAJADOR se compromete a prestar sus servicios
            personales y exclusivos bajo la dependencia y direccion de EL PATRONO, desempenando el cargo de{' '}
            <strong>
              {data.contrato.cargo} (Nivel {data.contrato.nivel})
            </strong>
            , clasificado segun la <strong>Clausula 3</strong> de la Convencion Colectiva de la Industria de la
            Construccion 2023. Los servicios seran prestados especificamente en el proyecto denominado{' '}
            <strong>"{data.proyecto.nombre}"</strong>, ubicado en {data.proyecto.ubicacion}.
          </p>

          <p>
            <strong>SEGUNDA (DE LA NATURALEZA DEL CONTRATO):</strong> El presente contrato se celebra por{' '}
            <strong>Obra Determinada</strong> de conformidad con la Ley Organica del Trabajo, los Trabajadores y las
            Trabajadoras (LOTTT). La relacion laboral terminara sin previo aviso ni derecho a indemnizacion
            sustitutiva al concluir las labores para las cuales fue contratado en el mencionado proyecto, estimadas en{' '}
            {data.proyecto.duracion_estimada}.
          </p>

          <p>
            <strong>TERCERA (DE LA REMUNERACION):</strong> EL PATRONO pagara a EL TRABAJADOR un{' '}
            <strong>Salario Basico Diario de {data.contrato.salario_diario} VES</strong>, de conformidad con el
            tabulador vigente (Clausula 33). Adicionalmente, percibira un{' '}
            <strong>Bono de Asistencia Diaria de {data.contrato.bono_asistencia} VES</strong> (Clausula 34 de la
            Gaceta Oficial 6.752) por cada dia efectivamente laborado. Las deducciones de ley seran aplicadas sobre
            el salario basico.
          </p>
          <p>
            <strong>PAGO INICIAL:</strong> Para esta contratacion se establece un monto acordado de{' '}
            <strong>{data.contrato.monto_acordado_usd.toFixed(2)} USD</strong> con anticipo del{' '}
            <strong>{data.contrato.porcentaje_inicial}%</strong>.
          </p>

          <p>
            <strong>CUARTA (CONFIDENCIALIDAD E INTEGRIDAD):</strong> EL TRABAJADOR declara haber aprobado las
            evaluaciones de seguridad e integridad corporativa de CASA INTELIGENTE, comprometiendose a mantener los
            mas altos estandares de etica operativa y el resguardo de informacion tecnica y domotica del cliente.
          </p>
        </div>

        <div className="mt-24 grid grid-cols-2 gap-16 text-center">
          <div>
            <div className="border-t border-slate-400 pt-2 font-bold">Por EL PATRONO</div>
            <div className="text-sm text-slate-500">CASA INTELIGENTE C.A.</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-2 font-bold">Por EL TRABAJADOR</div>
            <div className="text-sm text-slate-500">CI: {data.empleado.cedula}</div>
            <div className="mt-4 hidden rounded border border-blue-200 bg-blue-50 py-1 font-mono text-xs text-blue-600">
              [Firma Digital por WhatsApp Pendiente]
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-slate-400">
          Documento generado el {data.contrato.fecha_inicio}. Hash de validacion: CI-PROJ-
          {data.proyecto.nombre.substring(0, 3).toUpperCase()}-{data.contrato.nivel}
        </div>
      </div>
    </div>
  );
}
