'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, StyleSheet, Text, pdf } from '@react-pdf/renderer';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FormularioLaboralRRHH } from './FormularioLaboralRRHH';

function contratoIdDesdeParams(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return (raw[0] ?? '').trim();
  return typeof raw === 'string' ? raw.trim() : '';
}

type LaboralPayload = {
  fecha_ingreso: string | null;
  recruitment_need_id: string | null;
  cargo_oficio_desempeño: string | null;
  tabulador_nivel: number | null;
  salario_basico_diario_ves: number | null;
  forma_pago: string | null;
  lugar_pago: string | null;
  jornada_trabajo: string | null;
  lugar_prestacion_servicio: string | null;
  tipo_contrato: string | null;
  objeto_contrato: string | null;
  numero_oficio_tabulador: string | null;
  gaceta_denominacion_oficio: string | null;
};

type ContratoPayload = {
  id: string;
  empleado: { nombre: string; cedula: string; direccion: string };
  patrono?: {
    nombre: string;
    domicilio_fiscal: string;
    representante: string | null;
  };
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
    laboral?: LaboralPayload | null;
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
        <Text style={styles.title}>{(data.patrono?.nombre ?? 'CASA INTELIGENTE').toUpperCase()}</Text>
        <Text style={styles.subtitle}>Contrato Individual de Trabajo para Obra Determinada</Text>
        <Text style={styles.p}>
          {`Entre ${data.patrono?.nombre ?? 'EL PATRONO'}${
            data.patrono?.domicilio_fiscal?.trim()
              ? `, domicilio fiscal en ${data.patrono.domicilio_fiscal},`
              : ''
          } y el trabajador ${data.empleado.nombre}, CI ${data.empleado.cedula}, se celebra contrato para el proyecto «${
            data.proyecto.nombre
          }» ubicado en ${data.proyecto.ubicacion}.`}
        </Text>
        <Text style={styles.p}>
          Cargo: {data.contrato.cargo} (Nivel {data.contrato.nivel}). Duración estimada: {data.proyecto.duracion_estimada}.
        </Text>
        <Text style={styles.p}>
          Salario diario: {data.contrato.salario_diario} VES. Bono asistencia diario: {data.contrato.bono_asistencia} VES.
        </Text>
        <Text style={styles.p}>
          Monto acordado obra: {Number(data.contrato.monto_acordado_usd ?? 0).toFixed(2)} USD. Inicial:{' '}
          {Number(data.contrato.porcentaje_inicial ?? 0)}%.
        </Text>
        <Text style={styles.p}>Fecha de inicio / ingreso (RRHH): {data.contrato.fecha_inicio}</Text>
        {data.contrato.laboral?.lugar_prestacion_servicio ? (
          <Text style={styles.p}>Lugar de prestación del servicio: {data.contrato.laboral.lugar_prestacion_servicio}</Text>
        ) : null}
        {data.contrato.laboral?.forma_pago ? (
          <Text style={styles.p}>
            Forma de pago: {data.contrato.laboral.forma_pago}
            {data.contrato.laboral.lugar_pago ? ` — ${data.contrato.laboral.lugar_pago}` : ''}
          </Text>
        ) : null}
        {data.contrato.laboral?.jornada_trabajo ? (
          <Text style={styles.p}>Jornada: {data.contrato.laboral.jornada_trabajo}</Text>
        ) : null}
        {data.contrato.laboral?.tipo_contrato ? (
          <Text style={styles.p}>Tipo de contrato: {data.contrato.laboral.tipo_contrato}</Text>
        ) : null}
        {data.contrato.laboral?.numero_oficio_tabulador ? (
          <Text style={styles.p}>
            Oficio tabulador Gaceta: {data.contrato.laboral.numero_oficio_tabulador}
            {data.contrato.laboral.gaceta_denominacion_oficio
              ? ` — ${data.contrato.laboral.gaceta_denominacion_oficio}`
              : ''}
          </Text>
        ) : null}
        {data.contrato.laboral?.objeto_contrato ? (
          <Text style={styles.p}>Objeto: {data.contrato.laboral.objeto_contrato}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

export default function ContratoPreview() {
  const routeParams = useParams();
  const contractId = contratoIdDesdeParams(routeParams?.id as string | string[] | undefined);

  const componenteRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<ContratoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  const cargarContrato = useCallback(async () => {
    if (!contractId) throw new Error('Falta el identificador del contrato en la URL.');
    const r = await fetch(`/api/talento/contratos/${encodeURIComponent(contractId)}`);
    const body = (await r.json()) as ContratoPayload & { error?: string };
    if (!r.ok) throw new Error(body.error ?? 'No se pudo cargar contrato.');
    setData(body);
  }, [contractId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cargarContrato()
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cargarContrato]);

  const alGuardarLaboral = useCallback(async () => {
    await cargarContrato();
    setSnapshotVersion((v) => v + 1);
  }, [cargarContrato]);

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

  if (!contractId) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] p-8 text-sm text-amber-200">
        No se pudo leer el id del contrato en la ruta. Usa una URL del tipo{' '}
        <code className="rounded bg-white/10 px-1">/talento/admin/contratos/preview/[uuid]</code>.
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0F] p-8 text-sm text-zinc-400">Cargando contrato…</div>;
  }
  if (error || !data) {
    return <div className="min-h-screen bg-[#0A0A0F] p-8 text-sm text-red-400">{error ?? 'Contrato no disponible.'}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#0A0A0F] p-8 pb-24 font-sans">
      <FormularioLaboralRRHH
        contractId={contractId}
        snapshotVersion={snapshotVersion}
        patronoNombre={data.patrono?.nombre}
        patronoDomicilioFiscal={data.patrono?.domicilio_fiscal}
        laboral={data.contrato.laboral}
        cargoSugerido={data.contrato.cargo}
        nivelSugerido={Number(data.contrato.nivel ?? 0)}
        proyectoNombre={String(data.proyecto.nombre ?? '')}
        proyectoUbicacion={String(data.proyecto.ubicacion ?? '')}
        onGuardado={alGuardarLaboral}
      />

      <div className="mb-6 flex w-full max-w-4xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Previsualización de contrato</h1>
          <p className="text-sm text-zinc-500">Complete los datos laborales arriba y emita el PDF cuando esté listo.</p>
        </div>
        <button
          onClick={handleImprimirPDF}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-6 py-2 font-bold text-black shadow-md transition-all hover:opacity-95"
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
          <h2 className="text-3xl font-black tracking-tighter">
            {(data.patrono?.nombre ?? 'CASA INTELIGENTE').toUpperCase()}
          </h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-slate-600">
            Contrato Individual de Trabajo para Obra Determinada
          </p>
        </div>

        <div className="space-y-6 text-sm">
          <p>
            Entre la sociedad mercantil <strong>{data.patrono?.nombre ?? 'EL PATRONO'}</strong>
            {data.patrono?.domicilio_fiscal?.trim() ? (
              <>
                , domicilio fiscal en <strong>{data.patrono.domicilio_fiscal}</strong>
              </>
            ) : (
              <>, domicilio fiscal por registrar en la entidad del proyecto</>
            )}
            , en lo sucesivo denominada &quot;EL PATRONO&quot;, y por la otra parte el ciudadano{' '}
            <strong>{data.empleado.nombre}</strong>, titular de la Cedula de Identidad Nro.{' '}
            <strong>{data.empleado.cedula}</strong>, domiciliado en <strong>{data.empleado.direccion}</strong>, en lo
            sucesivo denominado &quot;EL TRABAJADOR&quot;, se ha convenido en celebrar el presente Contrato de Trabajo,
            el cual se regira por las siguientes clausulas:
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
            <strong>{Number(data.contrato.monto_acordado_usd ?? 0).toFixed(2)} USD</strong> con anticipo del{' '}
            <strong>{Number(data.contrato.porcentaje_inicial ?? 0)}%</strong>.
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
            <div className="text-sm text-slate-500">{data.patrono?.nombre ?? 'Patrono'}</div>
            {data.patrono?.representante?.trim() ? (
              <div className="mt-1 text-xs text-slate-500">{data.patrono.representante}</div>
            ) : null}
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
          {(String(data.proyecto.nombre ?? 'PRY').trim().slice(0, 3) || 'PRY').toUpperCase()}-
          {Number(data.contrato.nivel ?? 0)}
        </div>
      </div>
    </div>
  );
}
