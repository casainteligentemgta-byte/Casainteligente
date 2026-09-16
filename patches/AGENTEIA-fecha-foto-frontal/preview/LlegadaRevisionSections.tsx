"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Camera } from "lucide-react";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import {
  OPCIONES_OK_DANO,
  PlanillaChecklistProgress,
  PlanillaChecklistRow,
} from "@/components/nfc/PlanillaChecklistTap";
import {
  LLEGADA_CHECKLIST_ITEMS,
  type LlegadaChecklistNotasState,
  type LlegadaChecklistRespuesta,
  type LlegadaChecklistState,
} from "@/lib/importacion/llegada-catalog";
import { formatFechaFotoInspeccion } from "@/lib/importacion/fecha-foto";
import {
  MEMORIA_FOTOGRAFICA_TIPOS,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type ImprontaEstado = "coincide" | "no_coincide" | "no_leido" | null;

type Props = {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (next: VehiculosDocumentos) => void;
  fotosCount: number;
  expectedSerial: string;
  improntaEstado: ImprontaEstado;
  setImprontaEstado: (next: ImprontaEstado) => void;
  improntaLeido: string | null;
  setImprontaLeido: (next: string | null) => void;
  forzarImpronta: boolean;
  setForzarImpronta: (next: boolean) => void;
  canForzarImpronta: boolean;
  canForce: boolean;
  improntaOk: boolean;
  checklist: LlegadaChecklistState;
  setChecklist: Dispatch<SetStateAction<LlegadaChecklistState>>;
  checklistNotas: LlegadaChecklistNotasState;
  setChecklistNotas: Dispatch<SetStateAction<LlegadaChecklistNotasState>>;
  checklistMarked: number;
  otrosNotas: string;
  setOtrosNotas: (next: string) => void;
  onUploadedMessage: (msg: string) => void;
};

/**
 * Inspección fotográfica (memoria descriptiva) + cuestionario de revisión.
 * Se usa en Llegada y, tras la constancia de inspección, en desaduanamiento.
 */
export function LlegadaRevisionSections({
  vehiculoId,
  docs,
  setDocs,
  fotosCount,
  expectedSerial,
  improntaEstado,
  setImprontaEstado,
  improntaLeido,
  setImprontaLeido,
  forzarImpronta,
  setForzarImpronta,
  canForzarImpronta,
  canForce,
  improntaOk,
  checklist,
  setChecklist,
  checklistNotas,
  setChecklistNotas,
  checklistMarked,
  otrosNotas,
  setOtrosNotas,
  onUploadedMessage,
}: Props) {
  const [fechaFotoFrontal, setFechaFotoFrontal] = useState<string | null>(
    docs.foto_frontal?.captured_at ?? null
  );

  useEffect(() => {
    const persisted = docs.foto_frontal?.captured_at ?? null;
    if (persisted) setFechaFotoFrontal(persisted);
    else if (!docs.foto_frontal?.url) setFechaFotoFrontal(null);
  }, [docs.foto_frontal?.captured_at, docs.foto_frontal?.url]);

  const fechaFotoLabel = formatFechaFotoInspeccion(fechaFotoFrontal);

  return (
    <>
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug text-slate-100">
          <Camera className="h-5 w-5 shrink-0 text-cyan-400" />
          Inspección fotográfica
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {fotosCount}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </h2>
        {fechaFotoLabel ? (
          <p className="mt-2 text-sm font-medium text-cyan-300">
            {fechaFotoLabel}
          </p>
        ) : null}
        <p className={`text-sm text-slate-400 ${fechaFotoLabel ? "mt-1" : "mt-2"}`}>
          La hace el personal de la aduanera. Memoria descriptiva del vehículo.
          La impronta es opcional; si la cargas, el serial debe coincidir con el
          del expediente.
        </p>
        <div className="mt-5 grid gap-3">
          {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              hint={
                tipo === "foto_impronta"
                  ? "Opcional · si la subes, se verifica el serial"
                  : ""
              }
              actionLabel="Tomar / subir foto"
              annotateBeforeUpload
              verifySerialAgainstExpediente={tipo === "foto_impronta"}
              initialImprontaVerify={
                tipo === "foto_impronta" && improntaEstado
                  ? {
                      estado: improntaEstado,
                      expected: expectedSerial,
                      leido: improntaLeido,
                      message:
                        improntaEstado === "coincide"
                          ? `Serial verificado: coincide con el del expediente (${expectedSerial}).`
                          : improntaEstado === "no_coincide"
                            ? `El serial leído (${improntaLeido ?? "—"}) no coincide con el precargado (${expectedSerial || "—"}).`
                            : "No se pudo leer el serial en la foto anterior. Vuelve a tomarla.",
                    }
                  : null
              }
              onImprontaVerified={(result) => {
                setImprontaEstado(result.estado);
                setImprontaLeido(result.leido);
                if (result.estado === "coincide") setForzarImpronta(false);
              }}
              onImageCaptureDate={
                tipo === "foto_frontal"
                  ? (iso) => {
                      if (iso) setFechaFotoFrontal(iso);
                    }
                  : undefined
              }
              onUploaded={(next) => {
                setDocs(next);
                if (tipo === "foto_frontal") {
                  const captured = next.foto_frontal?.captured_at;
                  if (captured) setFechaFotoFrontal(captured);
                }
                onUploadedMessage(
                  tipo === "foto_impronta"
                    ? "Foto de impronta guardada · verificación de serial"
                    : "Foto guardada"
                );
              }}
            />
          ))}
        </div>

        {improntaEstado === "no_coincide" ? (
          <p className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            No puedes continuar mientras el serial de la impronta no coincida.
            Corrige el serial en Registro o toma otra foto.
          </p>
        ) : null}

        {canForce && !improntaOk ? (
          <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-100">
            <input
              type="checkbox"
              checked={forzarImpronta}
              onChange={(e) => setForzarImpronta(e.target.checked)}
              className="mt-1"
            />
            <span>
              Confirmo que revisé la impronta manualmente (OCR no pudo leer el
              serial con claridad).
            </span>
          </label>
        ) : null}

        {!canForzarImpronta &&
        !improntaOk &&
        improntaEstado !== "no_coincide" &&
        Boolean(docs.foto_impronta?.url) ? (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
            El OCR no verificó el serial. Un operador del taller debe confirmar
            la impronta o debes tomar otra foto más clara.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">
          Cuestionario de revisión del vehículo
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Inspección del personal de la aduanera. Marca cada ítem (OK / Daño).
          Obligatorio completar los {LLEGADA_CHECKLIST_ITEMS.length} puntos para
          continuar.
        </p>
        <div className="mt-4">
          <PlanillaChecklistProgress
            marked={checklistMarked}
            total={LLEGADA_CHECKLIST_ITEMS.length}
            tone="dark"
          />
        </div>
        <ul className="mt-5 space-y-2.5">
          {LLEGADA_CHECKLIST_ITEMS.map((item) => (
            <PlanillaChecklistRow
              key={item.id}
              etiqueta={item.etiqueta}
              value={checklist[item.id]}
              opciones={OPCIONES_OK_DANO}
              tone="dark"
              nota={checklistNotas[item.id] ?? ""}
              onNotaChange={(texto) =>
                setChecklistNotas((prev) => ({
                  ...prev,
                  [item.id]: texto,
                }))
              }
              onChange={(v) => {
                setChecklist((prev) => ({
                  ...prev,
                  [item.id]: v as LlegadaChecklistRespuesta,
                }));
                if (v !== "falla") {
                  setChecklistNotas((prev) => {
                    if (!prev[item.id]) return prev;
                    const next = { ...prev };
                    delete next[item.id];
                    return next;
                  });
                }
              }}
            />
          ))}
        </ul>
        <label className="mt-5 block space-y-2.5">
          <span className="text-sm text-slate-400">Otros dispositivos / notas</span>
          <textarea
            rows={3}
            value={otrosNotas}
            onChange={(e) => setOtrosNotas(e.target.value)}
            placeholder="Ej. candado de volante, corte de combustible…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>
      </section>
    </>
  );
}
