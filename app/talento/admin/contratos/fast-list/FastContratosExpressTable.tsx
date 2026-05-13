'use client';

import Link from 'next/link';
import { Download, FileCheck, FileText, Link2, Printer, Share2, Trash2, Upload, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { bonoUsdABs, tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import { cn } from '@/lib/utils';

/** Relación many-to-one: PostgREST a veces devuelve objeto único o array de un elemento. */
export type ProyectoExpressJoin = {
  nombre: string;
  ci_entidades?: { nombre: string; rif: string | null } | { nombre: string; rif: string | null }[] | null;
};

/** Fila devuelta por PostgREST con relaciones anidadas (nombres según el `select` del servidor). */
export type ContratoExpressListItem = {
  id: string;
  created_at: string;
  obrero_cedula: string;
  obrero_nombre: string;
  proyecto_id: string;
  /** Bono variable en USD; en Bs al pagar con tasa BCV del día (ver env). */
  bono_manual_usd: number | string | null;
  salario_base_mensual_snapshot: number | string | null;
  pdf_storage_path: string;
  /** Migración 127: PDF o imagen firmada por el obrero. */
  pdf_firmado_storage_path?: string | null;
  pdf_firmado_subido_at?: string | null;
  formalizado?: boolean | null;
  formalizado_empleado_id?: string | null;
  ci_proyectos?: ProyectoExpressJoin | ProyectoExpressJoin[] | null;
};

function proyectoRel(r: ContratoExpressListItem): ProyectoExpressJoin | null {
  const p = r.ci_proyectos;
  if (p == null) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

function entidadRel(p: ProyectoExpressJoin | null): { nombre: string; rif: string | null } | null {
  if (!p?.ci_entidades) return null;
  const e = p.ci_entidades;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

const fmtBs = (n: number) =>
  new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function salarioSnapshotBs(r: ContratoExpressListItem): number {
  const s = Number(r.salario_base_mensual_snapshot);
  return Number.isFinite(s) && s > 0 ? s : 0;
}

function bonoUsdNum(r: ContratoExpressListItem): number {
  const b = Number(r.bono_manual_usd);
  return Number.isFinite(b) && b >= 0 ? b : 0;
}

function nombreProyecto(r: ContratoExpressListItem): string {
  const p = proyectoRel(r);
  const n = p?.nombre?.trim();
  return n || r.proyecto_id.slice(0, 8);
}

function textoEntidad(r: ContratoExpressListItem): string {
  const e = entidadRel(proyectoRel(r));
  if (!e) return '—';
  const nombre = (e.nombre ?? '').trim();
  const rif = (e.rif ?? '').trim();
  if (nombre && rif) return `${nombre} · ${rif}`;
  return nombre || rif || '—';
}

type Props = {
  initialData: ContratoExpressListItem[];
  fetchError?: string | null;
};

/** PostgREST con RLS suele devolver `data: []` sin `error` si la sesión no ve filas; `[]` es truthy en JS. */
function tieneFilasExpress(data: unknown[] | null | undefined): boolean {
  return Array.isArray(data) && data.length > 0;
}

function normalizeExpressRowFromDb(row: Record<string, unknown>): ContratoExpressListItem {
  const bono =
    (row.bono_manual_usd as ContratoExpressListItem['bono_manual_usd']) ??
    (row.bono_manual_ves as ContratoExpressListItem['bono_manual_usd']) ??
    null;
  const { bono_manual_ves: _v, ...rest } = row;
  return { ...(rest as ContratoExpressListItem), bono_manual_usd: bono };
}

async function fetchSignedExpressPdfUrl(
  rowId: string,
  doc: 'generado' | 'firmado',
): Promise<{ url?: string; error?: string }> {
  const q = doc === 'firmado' ? '?doc=firmado' : '';
  const res = await fetch(`/api/talento/contratos-express/${rowId}/pdf-url${q}`);
  const j = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) return { error: j.error ?? `HTTP ${res.status}` };
  return { url: j.url };
}

export function FastContratosExpressTable({ initialData, fetchError }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const firmadoInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ContratoExpressListItem[]>(initialData);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const [liveFetchDone, setLiveFetchDone] = useState(false);
  const [firmadoUploadContratoId, setFirmadoUploadContratoId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  /** Recarga desde el navegador (evita listado obsoleto por caché del servidor). */
  useEffect(() => {
    let cancelled = false;
    const selects = [
      `id,created_at,obrero_cedula,obrero_nombre,proyecto_id,bono_manual_usd,salario_base_mensual_snapshot,pdf_storage_path,pdf_firmado_storage_path,pdf_firmado_subido_at,formalizado,formalizado_empleado_id,ci_proyectos(nombre,ci_entidades(nombre,rif))`,
      `id,created_at,obrero_cedula,obrero_nombre,proyecto_id,bono_manual_usd,salario_base_mensual_snapshot,pdf_storage_path,pdf_firmado_storage_path,pdf_firmado_subido_at,formalizado_empleado_id,ci_proyectos(nombre,ci_entidades(nombre,rif))`,
      `id,created_at,obrero_cedula,obrero_nombre,proyecto_id,bono_manual_usd,salario_base_mensual_snapshot,pdf_storage_path,pdf_firmado_storage_path,pdf_firmado_subido_at,formalizado_empleado_id`,
      `id,created_at,obrero_cedula,obrero_nombre,proyecto_id,bono_manual_usd,salario_base_mensual_snapshot,pdf_storage_path,formalizado,formalizado_empleado_id,ci_proyectos(nombre,ci_entidades(nombre,rif))`,
      `id,created_at,obrero_cedula,obrero_nombre,proyecto_id,bono_manual_usd,salario_base_mensual_snapshot,pdf_storage_path,formalizado_empleado_id,ci_proyectos(nombre,ci_entidades(nombre,rif))`,
      `id,created_at,obrero_cedula,obrero_nombre,proyecto_id,bono_manual_usd,salario_base_mensual_snapshot,pdf_storage_path,formalizado_empleado_id`,
    ];
    const ves = selects.map((s) => s.replace(/\bbono_manual_usd\b/g, 'bono_manual_ves'));

    (async () => {
      setLiveErr(null);
      let lastFail: string | null = null;
      for (const sel of [...selects, ...ves]) {
        const r = await supabase.from('ci_contratos_express').select(sel).order('created_at', { ascending: false });
        if (cancelled) return;
        if (r.error) {
          lastFail = r.error.message;
          continue;
        }
        if (tieneFilasExpress(r.data)) {
          setRows(
            (r.data as unknown[]).map((row) => normalizeExpressRowFromDb(row as Record<string, unknown>)),
          );
          setLiveFetchDone(true);
          return;
        }
      }
      if (!cancelled) {
        /** No sustituir datos del servidor (p. ej. service_role en RSC) por lista vacía vía RLS en el navegador. */
        setLiveErr(lastFail);
        setLiveFetchDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleDownload(path: string, nombre: string, rowId: string) {
    const p = (path ?? '').trim();
    if (!p) {
      toast.error('No se encontró la ruta del archivo');
      return;
    }
    setBusyId(rowId);
    try {
      const { data, error: stErr } = await supabase.storage.from('contratos_obreros').download(p);
      if (!stErr && data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Contrato_${nombre.replace(/\s/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const res = await fetch(`/api/talento/contratos-express/${rowId}/pdf-url`);
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        toast.error(j.error ?? stErr?.message ?? 'Error al descargar el PDF');
        return;
      }
      const blob = await fetch(j.url).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contrato_${nombre.replace(/\s/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar el PDF');
    } finally {
      setBusyId(null);
    }
  }

  async function eliminarContratoExpress(id: string, nombre: string, formalizado: boolean) {
    const detalle = formalizado
      ? 'Este express ya fue formalizado: el expediente en Talento (ci_empleados) no se borra. Solo se elimina el registro de esta lista y los archivos en almacenamiento.'
      : 'Se eliminará el registro y los PDF/archivos asociados en almacenamiento. Esta acción no se puede deshacer.';
    if (!window.confirm(`${detalle}\n\n¿Eliminar el contrato express de «${nombre}»?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}`, { method: 'DELETE' });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo eliminar');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Contrato express eliminado');
      router.refresh();
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyId(null);
    }
  }

  async function formalizar(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}/formalizar`, { method: 'POST' });
      const j = (await res.json()) as { empleado_id?: string; error?: string };
      if (res.status === 409 && j.empleado_id) {
        toast.message(j.error ?? 'Conflicto', { description: `Expediente: ${j.empleado_id.slice(0, 8)}…` });
        router.refresh();
        return;
      }
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo formalizar');
        return;
      }
      toast.success('Expediente creado en Talento', {
        description: j.empleado_id ? `ID: ${j.empleado_id}` : undefined,
      });
      router.refresh();
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyId(null);
    }
  }

  async function copiarEnlaceGenerado(rowId: string) {
    const { url, error } = await fetchSignedExpressPdfUrl(rowId, 'generado');
    if (error || !url) {
      toast.error(error ?? 'No se obtuvo enlace');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado', { description: 'Válido aprox. 1 h. Pégalo en WhatsApp, correo, etc.' });
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  }

  async function compartirContrato(rowId: string, nombre: string) {
    const { url, error } = await fetchSignedExpressPdfUrl(rowId, 'generado');
    if (error || !url) {
      toast.error(error ?? 'No se obtuvo enlace');
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Contrato express — ${nombre}`,
          text: 'Enlace para ver o descargar el contrato (caduca en aprox. 1 hora).',
          url,
        });
        toast.success('Compartido');
      } else {
        await navigator.clipboard.writeText(url);
        toast.message('Enlace copiado', { description: 'Este navegador no tiene «Compartir»; se copió al portapapeles.' });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast.error('No se pudo compartir');
    }
  }

  async function imprimirContrato(rowId: string) {
    const { url, error } = await fetchSignedExpressPdfUrl(rowId, 'generado');
    if (error || !url) {
      toast.error(error ?? 'No se pudo abrir el PDF');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.message('PDF en nueva pestaña', {
      description: 'Use Archivo → Imprimir o Ctrl+P en el visor del PDF (impresión física o PDF).',
    });
  }

  function abrirSelectorFirmado(contratoId: string) {
    setFirmadoUploadContratoId(contratoId);
    queueMicrotask(() => firmadoInputRef.current?.click());
  }

  async function onFirmadoFileChange(ev: ChangeEvent<HTMLInputElement>) {
    const id = firmadoUploadContratoId;
    const file = ev.target.files?.[0];
    ev.target.value = '';
    setFirmadoUploadContratoId(null);
    if (!file || !id) return;
    setBusyId(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/talento/contratos-express/${id}/pdf-firmado`, { method: 'POST', body: fd });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo subir el archivo');
        return;
      }
      toast.success('Documento firmado guardado', { description: 'Queda registrado en este listado.' });
      router.refresh();
    } catch {
      toast.error('Error de red al subir');
    } finally {
      setBusyId(null);
    }
  }

  async function descargarFirmado(rowId: string, nombre: string) {
    setBusyId(rowId);
    try {
      const { url, error } = await fetchSignedExpressPdfUrl(rowId, 'firmado');
      if (error || !url) {
        toast.error(error ?? 'No hay archivo firmado');
        return;
      }
      const blob = await fetch(url).then((r) => r.blob());
      const mime = blob.type || 'application/pdf';
      const ext = mime.includes('png')
        ? 'png'
        : mime.includes('jpeg') || mime.includes('jpg')
          ? 'jpg'
          : mime.includes('webp')
            ? 'webp'
            : 'pdf';
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `Contrato_firmado_${nombre.replace(/\s/g, '_')}.${ext}`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch {
      toast.error('Error al descargar el documento firmado');
    } finally {
      setBusyId(null);
    }
  }

  const totalesLista = useMemo(() => {
    const tasa = tasaBcvVesPorUsdFromEnv();
    let base = 0;
    let bonosUsd = 0;
    for (const c of rows) {
      base += salarioSnapshotBs(c);
      bonosUsd += bonoUsdNum(c);
    }
    const bonosBsRef = tasa != null ? bonoUsdABs(bonosUsd, tasa) : null;
    return { base, bonosUsd, bonosBsRef, tasa };
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 pb-28">
      <input
        ref={firmadoInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFirmadoFileChange}
      />
      {fetchError ? (
        <p className="mb-4 rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90">
          Aviso al cargar en servidor: {fetchError}. Los datos de la tabla se actualizan desde tu sesión en Supabase.
        </p>
      ) : null}
      {liveFetchDone && rows.length === 0 && liveErr ? (
        <p className="mb-4 text-sm text-red-400">
          No se pudo leer la lista desde el navegador: {liveErr}. Comprueba que la tabla{' '}
          <code className="text-zinc-500">ci_contratos_express</code> exista y que tu usuario tenga permiso de lectura.
        </p>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-3">
          <Link href="/talento" className="text-zinc-500 hover:text-zinc-300">
            ← Talento
          </Link>
          <Link href="/talento/admin/contratos" className="text-zinc-500 hover:text-zinc-300">
            Contratos dinámicos
          </Link>
          <Link href="/talento/admin/contratos/fast-create" className="inline-flex items-center gap-1 text-amber-500/90 hover:text-amber-400">
            <FileText className="size-3.5 shrink-0" />
            Nuevo express
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contratos express (fast-track)</h1>
          <p className="text-sm text-zinc-400">
            Sin registro previo en <code className="text-zinc-500">ci_empleados</code>. Cada fila queda en esta lista al
            generar el express. Puede <strong className="text-zinc-300">copiar o compartir</strong> el enlace del PDF
            (~1 h), <strong className="text-zinc-300">imprimir</strong> desde el visor,{' '}
            <strong className="text-zinc-300">subir el PDF o escaneo</strong> una vez firmado por el obrero o{' '}
            <strong className="text-zinc-300">borrar</strong> un registro express (y sus archivos) desde la columna
            Acciones. Salario base: snapshot <strong className="text-zinc-300">mensual en Bs</strong> (tabulador). Bono:{' '}
            <strong className="text-zinc-300">USD</strong>; en cada pago se convierte a Bs con la tasa BCV del día.
            Para equivalentes en pantalla, define{' '}
            <code className="text-zinc-500">NEXT_PUBLIC_TASA_BCV_VES_POR_USD</code> (Bs por USD).
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {!liveFetchDone ? 'Cargando lista actualizada…' : liveErr ? null : 'No hay registros. Usa «Nuevo express» para generar uno.'}
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-sm text-zinc-400">Salario base (snapshot tabulador, mensual)</p>
              <p className="text-2xl font-bold tabular-nums text-zinc-100">{fmtBs(totalesLista.base)} Bs</p>
            </div>
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
              <p className="text-sm text-amber-200/80">Total bonos (USD)</p>
              <p className="text-2xl font-bold tabular-nums text-amber-400">{fmtUsd(totalesLista.bonosUsd)}</p>
            </div>
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/25 p-4">
              <p className="text-sm text-emerald-200/80">Bonos en Bs (referencia, tasa BCV configurada)</p>
              {totalesLista.bonosBsRef != null && totalesLista.tasa != null ? (
                <>
                  <p className="text-2xl font-bold tabular-nums text-emerald-400">{fmtBs(totalesLista.bonosBsRef)} Bs</p>
                  <p className="mt-1 text-[11px] text-emerald-200/60">
                    Suma de USD × {fmtBs(totalesLista.tasa)} Bs/USD (solo referencia; el pago usa la tasa del viernes).
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Sin tasa: añade <code className="text-zinc-600">NEXT_PUBLIC_TASA_BCV_VES_POR_USD</code> en el entorno.
                </p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/90 text-zinc-100">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Obrero</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead className="text-right">Salario (Bs/mes)</TableHead>
                  <TableHead className="text-right">Bono (USD)</TableHead>
                  <TableHead className="text-right">Bono ref. (Bs)</TableHead>
                  <TableHead className="min-w-[220px] text-right">Acciones</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-center">Eliminar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const busy = busyId === c.id;
                  const formalizado = Boolean(c.formalizado_empleado_id) || c.formalizado === true;
                  const salBs = salarioSnapshotBs(c);
                  const bonUsd = bonoUsdNum(c);
                  const tasa = totalesLista.tasa;
                  const bonBsRef = tasa != null ? bonoUsdABs(bonUsd, tasa) : null;
                  const tieneFirmado = Boolean((c.pdf_firmado_storage_path ?? '').trim());
                  return (
                    <TableRow key={c.id} className="border-zinc-800">
                      <TableCell className="whitespace-nowrap text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString('es-VE')}
                      </TableCell>
                      <TableCell className="font-medium text-white">{c.obrero_nombre}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300">{c.obrero_cedula}</TableCell>
                      <TableCell className="text-zinc-300">
                        {c.proyecto_id?.trim() ? (
                          <Link
                            href={`/proyectos/modulo/${encodeURIComponent(c.proyecto_id.trim())}?tab=solicitados`}
                            className="text-sky-400 hover:text-sky-300 hover:underline underline-offset-2"
                            title="Ir al módulo integral del proyecto (pestaña solicitados)"
                          >
                            {nombreProyecto(c)}
                          </Link>
                        ) : (
                          nombreProyecto(c)
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-zinc-400" title={textoEntidad(c)}>
                        {textoEntidad(c)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-zinc-200" title="Snapshot tabulador (mensual)">
                        {fmtBs(salBs)} Bs
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-amber-300" title="Acordado en USD">
                        {fmtUsd(bonUsd)}
                      </TableCell>
                      <TableCell
                        className={cn('text-right text-sm tabular-nums text-emerald-400/90')}
                        title={
                          tasa != null
                            ? `Equivalente con tasa referencia ${tasa} Bs/USD (actualizar el día de pago BCV)`
                            : 'Configure NEXT_PUBLIC_TASA_BCV_VES_POR_USD para ver equivalente'
                        }
                      >
                        {bonBsRef != null ? `${fmtBs(bonBsRef)} Bs` : '—'}
                      </TableCell>
                      <TableCell className="min-w-[220px] text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1 sm:gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-zinc-600 bg-zinc-900 px-2 text-zinc-100 hover:bg-zinc-800"
                            title="Descargar borrador generado (PDF)"
                            onClick={() => void handleDownload(c.pdf_storage_path, c.obrero_nombre, c.id)}
                          >
                            <Download className="size-4" />
                            <span className="ml-1 hidden sm:inline">PDF</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-zinc-600 bg-zinc-900 px-2 text-zinc-100 hover:bg-zinc-800"
                            title="Copiar enlace temporal del PDF (~1 h)"
                            onClick={() => void copiarEnlaceGenerado(c.id)}
                          >
                            <Link2 className="size-4" />
                            <span className="ml-1 hidden lg:inline">Copiar</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-zinc-600 bg-zinc-900 px-2 text-zinc-100 hover:bg-zinc-800"
                            title="Compartir enlace (o copiar si el navegador no permite compartir)"
                            onClick={() => void compartirContrato(c.id, c.obrero_nombre)}
                          >
                            <Share2 className="size-4" />
                            <span className="ml-1 hidden lg:inline">Enviar</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-zinc-600 bg-zinc-900 px-2 text-zinc-100 hover:bg-zinc-800"
                            title="Abrir PDF en nueva pestaña para imprimir (físico o guardar como PDF)"
                            onClick={() => void imprimirContrato(c.id)}
                          >
                            <Printer className="size-4" />
                            <span className="ml-1 hidden lg:inline">Imprimir</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-sky-800/60 bg-sky-950/40 px-2 text-sky-200 hover:bg-sky-950/60"
                            title="Subir PDF firmado o foto / escaneo (JPEG, PNG, WEBP)"
                            onClick={() => abrirSelectorFirmado(c.id)}
                          >
                            <Upload className="size-4" />
                            <span className="ml-1 hidden sm:inline">Firmado</span>
                          </Button>
                          {tieneFirmado ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              className="border-emerald-800/50 bg-emerald-950/30 px-2 text-emerald-200 hover:bg-emerald-950/50"
                              title="Descargar archivo firmado subido"
                              onClick={() => void descargarFirmado(c.id, c.obrero_nombre)}
                            >
                              <FileCheck className="size-4" />
                              <span className="ml-1 hidden sm:inline">OK</span>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy || formalizado}
                            className="text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300"
                            title={formalizado ? 'Ya formalizado' : 'Convertir a empleado regular (ci_empleados)'}
                            onClick={() => void formalizar(c.id)}
                          >
                            <UserPlus className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center align-middle">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          className="inline-flex items-center gap-1 border-red-800/70 bg-red-950/25 px-2.5 text-xs font-semibold text-red-200 hover:bg-red-950/45 hover:text-red-100"
                          title="Eliminar este contrato express y sus archivos en almacenamiento"
                          onClick={() => void eliminarContratoExpress(c.id, c.obrero_nombre, formalizado)}
                        >
                          <Trash2 className="size-4 shrink-0" aria-hidden />
                          Borrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/** Alias compatible con el nombre sugerido en plantillas. */
export const FastContratosTable = FastContratosExpressTable;
