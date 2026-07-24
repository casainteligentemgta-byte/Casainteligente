'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import {
  actualizarCotejoDocumento,
  agregarHerramientaObraDigital,
  avanzarAnticipoAListoParaPago,
  calcularAnticipoDesdeRendimiento,
  cerrarContratoHistorico,
  insertarDocumentoObraDigital,
  marcarAnticipoPagado,
  pasarContratoALiquidacion,
  registrarRendimientoDiario,
  upsertAnticipoMensualObraDigital,
} from '@/lib/obra-digital/obraDigitalServerActions';

function advanceKey(year: number, month: number) {
  return `${year}-${month}`;
}

export type LaborContractRow = {
  id: string;
  worker_name: string;
  worker_ci: string;
  contract_status: string;
  oficio: string;
  salary_per_day: string | number;
  lulo_partida_meta: string;
};

export type DocumentRow = {
  id: string;
  doc_type: string;
  storage_path: string;
  escaneo_firma_visible: boolean;
  escaneo_huella_visible: boolean;
  reference_month: number | null;
  reference_year: number | null;
  reference_week?: number | null;
  uploaded_at: string;
};

export type ToolRow = {
  id: string;
  tool_name: string;
  serial_number: string;
  status: string;
  replacement_value: string | number;
};

export type AdvanceRow = {
  id: string;
  month: number;
  year: number;
  calculated_accrued: string | number;
  max_advance_allowed: string | number;
  status: string;
};

export type DailyRow = {
  id: string;
  work_date: string;
  physical_advance: string | number;
};

export type AdvanceDiagnostic = {
  escaneoAnticipoValido: boolean;
  libroSemanalRecomendado: boolean;
};

type Props = {
  contract: LaborContractRow;
  documents: DocumentRow[];
  tools: ToolRow[];
  advances: AdvanceRow[];
  daily: DailyRow[];
  advanceDiagnostics: Record<string, AdvanceDiagnostic>;
};

function bucketPublicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/storage/v1/object/public/worker-docs/${encodeURI(path)}`;
}

function DocumentoCotejoCard({
  doc,
  contractId,
  busy,
  setBusy,
  refresh,
}: {
  doc: DocumentRow;
  contractId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  refresh: () => void;
}) {
  const [firma, setFirma] = useState(doc.escaneo_firma_visible);
  const [huella, setHuella] = useState(doc.escaneo_huella_visible);

  async function guardar() {
    setBusy(true);
    try {
      const r = await actualizarCotejoDocumento({
        documentId: doc.id,
        contractId,
        escaneoFirmaVisible: firma,
        escaneoHuellaVisible: huella,
      });
      if (!r.ok) toast.error(r.message);
      else {
        toast.success('Cotejo guardado');
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="font-mono text-xs text-emerald-300">{doc.doc_type}</span>
        {doc.doc_type === 'ANTICIPO_MENSUAL' && doc.reference_month != null && doc.reference_year != null ? (
          <p className="text-xs text-zinc-400">
            Periodo anticipo: {doc.reference_month}/{doc.reference_year}
          </p>
        ) : null}
        {doc.doc_type === 'LIBRO_OBRA_SEMANAL' &&
        doc.reference_month != null &&
        doc.reference_year != null &&
        doc.reference_week != null ? (
          <p className="text-xs text-zinc-400">
            Libro: semana {doc.reference_week} del mes {doc.reference_month}/{doc.reference_year}
          </p>
        ) : null}
        <p className="truncate text-xs text-zinc-500">{doc.storage_path}</p>
        <a
          href={bucketPublicUrl(doc.storage_path)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-400 underline"
        >
          Ver objeto en Storage (bucket público)
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={firma} disabled={busy} onChange={(e) => setFirma(e.target.checked)} />
          Firma visible
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={huella} disabled={busy} onChange={(e) => setHuella(e.target.checked)} />
          Huella visible
        </label>
        <Button type="button" size="sm" variant="outline" className="border-zinc-600" disabled={busy} onClick={() => void guardar()}>
          Guardar cotejo
        </Button>
      </div>
    </li>
  );
}

export default function ObraDigitalExpedienteClient({
  contract,
  documents,
  tools,
  advances,
  daily,
  advanceDiagnostics,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  const tieneCedula = documents.some((d) => d.doc_type === 'CEDULA');
  const tieneInventario = documents.some((d) => d.doc_type === 'INVENTARIO_ENTREGA');

  async function subirDocumento(
    file: File | null,
    docType: string,
    opts?: { referenceMonth?: number; referenceYear?: number; referenceWeek?: number },
  ) {
    if (!file) {
      toast.error('Selecciona un archivo PDF o JPG.');
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `obra-digital/${contract.id}/${crypto.randomUUID()}.${ext}`;
      const { error: up } = await supabase.storage.from('worker-docs').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (up) {
        toast.error(up.message);
        return;
      }
      const res = await insertarDocumentoObraDigital({
        contractId: contract.id,
        docType,
        storagePath: path,
        escaneoFirmaVisible: false,
        escaneoHuellaVisible: false,
        referenceMonth: opts?.referenceMonth ?? null,
        referenceYear: opts?.referenceYear ?? null,
        referenceWeek: opts?.referenceWeek ?? null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success('Documento registrado. Marca cotejo de firma y huella si el escaneo es legible.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();
  const [mesAnt, setMesAnt] = useState(now.getMonth() + 1);
  const [anioAnt, setAnioAnt] = useState(now.getFullYear());
  const [montoManual, setMontoManual] = useState('');
  const [mesLibro, setMesLibro] = useState(now.getMonth() + 1);
  const [anioLibro, setAnioLibro] = useState(now.getFullYear());
  const [semLibro, setSemLibro] = useState(1);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 text-zinc-100">
      <header className="space-y-2 border-b border-zinc-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Expediente de obra digital</p>
        <h1 className="text-2xl font-bold text-white">{contract.worker_name}</h1>
        <p className="text-sm text-zinc-400">
          CI {contract.worker_ci} · {contract.oficio} · Estado:{' '}
          <span className="font-mono text-emerald-200">{contract.contract_status}</span>
        </p>
        <p className="text-sm text-zinc-500">
          Salario/día: {String(contract.salary_per_day)} VES · Meta: {contract.lulo_partida_meta}
        </p>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Fase 1 — Onboarding</h2>
        <div className="space-y-4 text-sm text-zinc-300">
          <div>
            <p className="mb-2 font-medium text-zinc-200">1. Cédula de identidad</p>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                disabled={busy}
                onChange={(e) => void subirDocumento(e.target.files?.[0] ?? null, 'CEDULA')}
              />
              <Button type="button" variant="elite" size="sm" disabled={busy} asChild>
                <span>📁 Cargar cédula (PDF/JPG)</span>
              </Button>
            </label>
            {tieneCedula ? (
              <p className="mt-1 text-xs text-emerald-400">Cédula registrada en expediente.</p>
            ) : (
              <p className="mt-1 text-xs text-amber-400">Sin cédula: el PDF laboral (API) responderá 400.</p>
            )}
          </div>

          <div>
            <p className="mb-2 font-medium text-zinc-200">2. Acta de entrega de herramientas</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="border-zinc-600" asChild>
                <a href={`/api/obra-digital/contracts/${contract.id}/pdf-acta-entrega`} target="_blank" rel="noreferrer">
                  🖨️ Generar acta (PDF)
                </a>
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => void subirDocumento(e.target.files?.[0] ?? null, 'INVENTARIO_ENTREGA')}
                />
                <Button type="button" variant="elitePrimary" size="sm" disabled={busy} asChild>
                  <span>📷 Escanear y cargar acta firmada</span>
                </Button>
              </label>
            </div>
            {tieneInventario ? (
              <p className="mt-1 text-xs text-emerald-400">Acta cargada. Marca firma/huella visibles para pasar a ACTIVO (BD).</p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 font-medium text-zinc-200">Ficha laboral (PDF)</p>
            <Button
              type="button"
              size="sm"
              variant="elite"
              disabled={busy || !tieneCedula}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch('/api/contracts/generate-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contractId: contract.id }),
                  });
                  if (!r.ok) {
                    const j = await r.json().catch(() => ({}));
                    toast.error((j as { error?: string }).error ?? 'Error al generar PDF');
                    return;
                  }
                  const blob = await r.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank', 'noopener,noreferrer');
                } finally {
                  setBusy(false);
                }
              }}
            >
              📄 Generar ficha laboral (POST /api/contracts/generate-pdf)
            </Button>
            {!tieneCedula ? (
              <p className="mt-1 text-xs text-zinc-500">Bloqueado hasta registrar documento CEDULA.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Documentos del expediente</h2>
        <ul className="space-y-3 text-sm">
          {documents.length === 0 ? (
            <li className="text-zinc-500">Aún no hay documentos.</li>
          ) : (
            documents.map((d) => (
              <DocumentoCotejoCard
                key={d.id}
                doc={d}
                contractId={contract.id}
                busy={busy}
                setBusy={setBusy}
                refresh={() => router.refresh()}
              />
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Herramientas</h2>
        <form
          className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await agregarHerramientaObraDigital({
                contractId: contract.id,
                toolName: String(fd.get('tool_name')),
                serialNumber: String(fd.get('serial_number')),
                replacementValue: String(fd.get('replacement_value') || '0'),
              });
              if (!r.ok) toast.error(r.message);
              else {
                toast.success('Herramienta registrada');
                e.currentTarget.reset();
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <input name="tool_name" placeholder="Nombre" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm" required />
          <input name="serial_number" placeholder="Serial" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm" required />
          <input name="replacement_value" placeholder="Valor reposición" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm" />
          <Button type="submit" size="sm" variant="elite" disabled={busy}>
            Añadir
          </Button>
        </form>
        <ul className="text-sm text-zinc-300">
          {tools.map((t) => (
            <li key={t.id}>
              {t.tool_name} · {t.serial_number} · {t.status}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Fase 2 — Rendimiento (solo ACTIVO en BD)</h2>
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await registrarRendimientoDiario({
                contractId: contract.id,
                workDate: String(fd.get('work_date')),
                physicalAdvance: String(fd.get('physical_advance')),
              });
              if (!r.ok) toast.error(r.message);
              else {
                toast.success('Rendimiento guardado');
                e.currentTarget.reset();
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <input name="work_date" type="date" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1" required />
          <input name="physical_advance" placeholder="Avance físico (ej. metros)" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1" required />
          <Button type="submit" size="sm" variant="elitePrimary" disabled={busy}>
            Registrar día
          </Button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">{daily.length} día(s) registrados en expediente.</p>
      </section>

      <section className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-5">
        <h2 className="mb-2 text-lg font-semibold text-amber-100">Fase 2b — Libro de obra semanal (recomendado)</h2>
        <p className="mb-4 text-sm text-amber-200/90">
          Evidencia en expediente: <strong className="text-amber-50">no bloquea</strong> el anticipo en base de datos.
          Contabilidad puede exigirlo como buena práctica; si falta, verás un aviso al pasar a «Listo para pago».
        </p>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div>
            <span className="mb-1 block text-xs text-zinc-500">Mes</span>
            <select
              value={mesLibro}
              onChange={(e) => setMesLibro(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-zinc-500">Año</span>
            <input
              type="number"
              value={anioLibro}
              onChange={(e) => setAnioLibro(Number(e.target.value))}
              className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-zinc-500">Semana en el mes (1–5)</span>
            <select
              value={semLibro}
              onChange={(e) => setSemLibro(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <option key={s} value={s}>
                  Semana {s}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" variant="elite" asChild>
            <a
              href={`/api/obra-digital/contracts/${contract.id}/pdf-libro-semana?month=${mesLibro}&year=${anioLibro}&week=${semLibro}`}
              target="_blank"
              rel="noreferrer"
            >
              🖨️ Plantilla libro (PDF)
            </a>
          </Button>
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              disabled={busy}
              onChange={(e) =>
                void subirDocumento(e.target.files?.[0] ?? null, 'LIBRO_OBRA_SEMANAL', {
                  referenceMonth: mesLibro,
                  referenceYear: anioLibro,
                  referenceWeek: semLibro,
                })
              }
            />
            <Button type="button" size="sm" variant="elitePrimary" disabled={busy} asChild>
              <span>📷 Cargar libro escaneado</span>
            </Button>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Anticipo mensual — flujo ordenado (fase A)</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Periodo seleccionado para carta y escaneo: <span className="font-mono text-emerald-300">{mesAnt}/{anioAnt}</span>.
          La base de datos solo permite «Listo para pago» / «Pagado» si existe <code className="text-zinc-300">ANTICIPO_MENSUAL</code>{' '}
          con firma y huella para ese mes y año.
        </p>
        <ol className="mb-6 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>Calcular o registrar el acumulado del mes (contabilidad / rendimiento).</li>
          <li>Generar la carta de anticipo en PDF y firmarla en físico con el trabajador.</li>
          <li>Subir el escaneo; en «Documentos del expediente» marcar <strong>firma</strong> y <strong>huella</strong> visibles y guardar.</li>
          <li>Opcional recomendado: libro de obra semanal del mismo mes (arriba).</li>
          <li>Solo entonces: «Marcar listo para pago» (habilitado cuando el cotejo del anticipo esté completo).</li>
        </ol>
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            value={mesAnt}
            onChange={(e) => setMesAnt(Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Mes {i + 1}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={anioAnt}
            onChange={(e) => setAnioAnt(Number(e.target.value))}
            className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
          />
          <Button
            type="button"
            size="sm"
            variant="elite"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await calcularAnticipoDesdeRendimiento(contract.id, mesAnt, anioAnt);
                if (!r.ok) toast.error(r.message);
                else toast.success('Anticipo calculado desde rendimiento diario');
              } finally {
                setBusy(false);
              }
            }}
          >
            Calcular desde rendimiento
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={montoManual}
            onChange={(e) => setMontoManual(e.target.value)}
            placeholder="Acumulado manual (VES)"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-zinc-600"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await upsertAnticipoMensualObraDigital({
                  contractId: contract.id,
                  month: mesAnt,
                  year: anioAnt,
                  calculatedAccrued: montoManual || '0',
                });
                if (!r.ok) toast.error(r.message);
                else toast.success('Anticipo mensual guardado (PAGO_BLOQUEADO hasta escaneo)');
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar acumulado
          </Button>
          <Button type="button" size="sm" variant="elite" asChild>
            <a
              href={`/api/obra-digital/contracts/${contract.id}/pdf-carta-anticipo?month=${mesAnt}&year=${anioAnt}`}
              target="_blank"
              rel="noreferrer"
            >
              🖨️ Carta anticipo (PDF)
            </a>
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Tras imprimir y firmar en físico, carga el escaneo como ANTICIPO_MENSUAL con el mismo mes/año y marca firma +
          huella; luego “Listo para pago”.
        </p>
        <label className="mt-2 inline-flex cursor-pointer text-sm">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            disabled={busy}
            onChange={(e) =>
              void subirDocumento(e.target.files?.[0] ?? null, 'ANTICIPO_MENSUAL', {
                referenceMonth: mesAnt,
                referenceYear: anioAnt,
              })
            }
          />
          <Button type="button" size="sm" variant="elitePrimary" disabled={busy} asChild>
            <span>📷 Cargar escaneo carta de anticipo</span>
          </Button>
        </label>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          {advances.map((a) => {
            const dk = advanceKey(a.year, a.month);
            const diag = advanceDiagnostics[dk] ?? {
              escaneoAnticipoValido: false,
              libroSemanalRecomendado: false,
            };
            return (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-zinc-800/80 p-2">
              <span>
                {a.month}/{a.year} — acum. {String(a.calculated_accrued)} / máx 75% {String(a.max_advance_allowed)} —{' '}
                <span className="font-mono text-emerald-300">{a.status}</span>
              </span>
              {a.status === 'PAGO_BLOQUEADO' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="elite"
                  disabled={busy || !diag.escaneoAnticipoValido}
                  title={
                    !diag.escaneoAnticipoValido
                      ? 'Sube el escaneo ANTICIPO_MENSUAL y marca firma + huella en documentos'
                      : undefined
                  }
                  onClick={async () => {
                    if (!diag.libroSemanalRecomendado) {
                      toast.message('Recomendación de expediente', {
                        description:
                          'No hay libro de obra semanal cotejado para este mes. No bloquea el pago; conviene cargarlo para inspecciones.',
                      });
                    }
                    setBusy(true);
                    try {
                      const r = await avanzarAnticipoAListoParaPago(contract.id, a.month, a.year);
                      if (!r.ok) toast.error(r.message);
                      else toast.success('Estado: LISTO_PARA_PAGO');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Marcar listo para pago
                </Button>
              ) : null}
              {a.status === 'LISTO_PARA_PAGO' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-zinc-600"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await marcarAnticipoPagado(contract.id, a.month, a.year);
                      if (!r.ok) toast.error(r.message);
                      else toast.success('Marcado PAGADO');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Marcar pagado
                </Button>
              ) : null}
            </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Liquidación y cierre</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="elite"
            size="sm"
            disabled={busy || contract.contract_status !== 'ACTIVO'}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await pasarContratoALiquidacion(contract.id);
                if (!r.ok) toast.error(r.message);
                else toast.success('Contrato en LIQUIDACION');
              } finally {
                setBusy(false);
              }
            }}
          >
            Pasar a liquidación
          </Button>
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              disabled={busy || contract.contract_status !== 'LIQUIDACION'}
              onChange={(e) => void subirDocumento(e.target.files?.[0] ?? null, 'FINIQUITO')}
            />
            <Button type="button" size="sm" variant="elitePrimary" disabled={busy || contract.contract_status !== 'LIQUIDACION'} asChild>
              <span>📷 Cargar finiquito firmado</span>
            </Button>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-600"
            disabled={busy || contract.contract_status !== 'LIQUIDACION'}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await cerrarContratoHistorico(contract.id);
                if (!r.ok) toast.error(r.message);
                else toast.success('CERRADO_HISTORICO (requiere FINIQUITO válido en BD)');
              } finally {
                setBusy(false);
              }
            }}
          >
            Cerrar histórico
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Cierre exige documento FINIQUITO con firma y huella marcadas; la transición la valida PostgreSQL.
        </p>
      </section>
    </div>
  );
}
