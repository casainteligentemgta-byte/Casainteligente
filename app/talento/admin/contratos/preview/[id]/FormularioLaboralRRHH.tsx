'use client';

import { Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { denominacionOficioGaceta, salarioBasicoDiarioVesDesdeNivel } from '@/lib/talento/contratoGacetaLaboral';

export type LaboralFormProps = {
  contractId: string;
  /** Se incrementa tras guardar para sincronizar el formulario con el servidor. */
  snapshotVersion: number;
  /** Patrono desde entidad del proyecto (solo lectura; alimenta PDF legal / plantilla). */
  patronoNombre?: string;
  patronoDomicilioFiscal?: string;
  laboral: {
    fecha_ingreso: string | null;
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
  } | null | undefined;
  cargoSugerido: string;
  nivelSugerido: number;
  proyectoNombre: string;
  proyectoUbicacion: string;
  onGuardado: () => Promise<void>;
};

type FormState = {
  fecha_ingreso: string;
  cargo_oficio_desempeño: string;
  tabulador_nivel: string;
  salario_basico_diario_ves: string;
  forma_pago: string;
  lugar_pago: string;
  jornada_trabajo: string;
  lugar_prestacion_servicio: string;
  tipo_contrato: string;
  objeto_contrato: string;
  numero_oficio_tabulador: string;
  gaceta_denominacion_oficio: string;
};

function mapToForm(p: LaboralFormProps): FormState {
  const l = p.laboral;
  const ns = Number(p.nivelSugerido);
  const nivel =
    l?.tabulador_nivel != null
      ? l.tabulador_nivel
      : Number.isFinite(ns) && ns >= 1 && ns <= 9
        ? Math.round(ns)
        : null;
  const salDef =
    l?.salario_basico_diario_ves != null
      ? String(l.salario_basico_diario_ves)
      : salarioBasicoDiarioVesDesdeNivel(nivel) != null
        ? String(salarioBasicoDiarioVesDesdeNivel(nivel))
        : '';
  const lugarDef =
    (l?.lugar_prestacion_servicio ?? '').trim() ||
    [p.proyectoNombre, p.proyectoUbicacion].filter(Boolean).join(' — ');
  return {
    fecha_ingreso: l?.fecha_ingreso ? String(l.fecha_ingreso).slice(0, 10) : '',
    cargo_oficio_desempeño: String(l?.cargo_oficio_desempeño ?? p.cargoSugerido ?? '').trim(),
    tabulador_nivel: nivel != null ? String(nivel) : '',
    salario_basico_diario_ves: salDef,
    forma_pago: (l?.forma_pago ?? '').trim(),
    lugar_pago: (l?.lugar_pago ?? '').trim(),
    jornada_trabajo: (l?.jornada_trabajo ?? '').trim(),
    lugar_prestacion_servicio: lugarDef,
    tipo_contrato: (() => {
      const t = String(l?.tipo_contrato ?? 'tiempo_determinado').trim();
      return t === 'tiempo_indeterminado' ? t : 'tiempo_determinado';
    })(),
    objeto_contrato: (l?.objeto_contrato ?? '').trim(),
    numero_oficio_tabulador: (l?.numero_oficio_tabulador ?? '').trim(),
    gaceta_denominacion_oficio: (l?.gaceta_denominacion_oficio ?? '').trim(),
  };
}

const inputClass =
  'mt-1 w-full rounded-lg border border-white/15 bg-[#12121a] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30';
const labelClass = 'block text-[11px] font-bold uppercase tracking-wide text-zinc-500';

export function FormularioLaboralRRHH(p: LaboralFormProps) {
  const [form, setForm] = useState<FormState>(() => mapToForm(p));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(mapToForm(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sincronizar solo al cambiar contrato o tras guardar (snapshotVersion).
  }, [p.contractId, p.snapshotVersion]);

  const aplicarSalarioDesdeNivel = useCallback(() => {
    const n = parseInt(form.tabulador_nivel, 10);
    const sb = salarioBasicoDiarioVesDesdeNivel(Number.isFinite(n) ? n : null);
    if (sb != null) {
      setForm((f) => ({ ...f, salario_basico_diario_ves: String(sb) }));
      toast.message('Salario actualizado desde tabulador 2023.');
    } else {
      toast.error('Indica un nivel tabulador entre 1 y 9.');
    }
  }, [form.tabulador_nivel]);

  const sincronizarDenominacionGaceta = useCallback(() => {
    const cod = form.numero_oficio_tabulador.trim();
    const den = denominacionOficioGaceta(cod);
    if (den) {
      setForm((f) => ({ ...f, gaceta_denominacion_oficio: den }));
      toast.success('Denominación cargada desde el tabulador Gaceta.');
    } else {
      toast.error('Código de oficio no encontrado en el catálogo (ej. 5.1, 3.22).');
    }
  }, [form.numero_oficio_tabulador]);

  async function guardar() {
    setGuardando(true);
    try {
      const body: Record<string, unknown> = {
        fecha_ingreso: form.fecha_ingreso.trim() || null,
        cargo_oficio_desempeño: form.cargo_oficio_desempeño.trim() || null,
        lugar_prestacion_servicio: form.lugar_prestacion_servicio.trim() || null,
        objeto_contrato: form.objeto_contrato.trim() || null,
        numero_oficio_tabulador: form.numero_oficio_tabulador.trim() || null,
        gaceta_denominacion_oficio: form.gaceta_denominacion_oficio.trim() || null,
        lugar_pago: form.lugar_pago.trim() || null,
        forma_pago: form.forma_pago.trim() || null,
        jornada_trabajo: form.jornada_trabajo.trim() || null,
        tipo_contrato: form.tipo_contrato.trim() || null,
      };

      const niv = parseInt(form.tabulador_nivel, 10);
      if (form.tabulador_nivel.trim() === '') {
        body.tabulador_nivel = null;
      } else if (Number.isInteger(niv) && niv >= 1 && niv <= 9) {
        body.tabulador_nivel = niv;
      } else {
        toast.error('Nivel tabulador: entero 1–9 o vacío.');
        return;
      }

      const sal = parseFloat(form.salario_basico_diario_ves.replace(',', '.'));
      if (form.salario_basico_diario_ves.trim() === '') {
        body.salario_basico_diario_ves = null;
      } else if (!Number.isFinite(sal) || sal <= 0) {
        toast.error('Salario básico diario (VES) inválido.');
        return;
      } else {
        body.salario_basico_diario_ves = sal;
      }

      const res = await fetch(`/api/talento/contratos/${encodeURIComponent(p.contractId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo guardar.');
        return;
      }
      toast.success('Datos laborales guardados.');
      await p.onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="mb-8 w-full max-w-4xl rounded-2xl border border-orange-500/35 p-6 shadow-lg"
      style={{ backgroundColor: 'rgba(10,10,15,0.92)' }}
    >
      <h2 className="text-lg font-bold text-white">Datos laborales (RRHH / Admin)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Fecha de ingreso, forma de pago, jornada y demás campos Gaceta. El cargo y el salario suelen venir de la vacante y
        del tabulador; puedes ajustarlos aquí antes de emitir el PDF.
      </p>
      {(p.patronoNombre?.trim() || p.patronoDomicilioFiscal?.trim()) ? (
        <div className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs text-zinc-300">
          <p className="font-bold uppercase tracking-wide text-sky-300/90">Patrono (entidad del proyecto)</p>
          <p className="mt-1">
            <span className="text-zinc-500">Razón social:</span>{' '}
            <span className="text-zinc-100">{p.patronoNombre?.trim() || '—'}</span>
          </p>
          <p className="mt-1">
            <span className="text-zinc-500">Domicilio fiscal:</span>{' '}
            <span className="text-zinc-100">{p.patronoDomicilioFiscal?.trim() || '— (complete en la ficha de la entidad)'}</span>
          </p>
          <p className="mt-2 text-[10px] text-zinc-500">
            Estos datos no se escriben aquí: salen de la entidad asignada al proyecto y del contrato PDF / plantilla legal.
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Fecha de ingreso
          <input
            type="date"
            className={inputClass}
            style={{ colorScheme: 'dark' }}
            value={form.fecha_ingreso}
            onChange={(e) => setForm((f) => ({ ...f, fecha_ingreso: e.target.value }))}
          />
        </label>
        <label className={labelClass}>
          Tipo de contrato
          <select
            className={inputClass}
            value={form.tipo_contrato}
            onChange={(e) => setForm((f) => ({ ...f, tipo_contrato: e.target.value }))}
          >
            <option value="tiempo_determinado">Tiempo determinado</option>
            <option value="tiempo_indeterminado">Tiempo indeterminado</option>
          </select>
        </label>
        <label className={`sm:col-span-2 ${labelClass}`}>
          Cargo u oficio a desempeñar
          <input
            className={inputClass}
            value={form.cargo_oficio_desempeño}
            onChange={(e) => setForm((f) => ({ ...f, cargo_oficio_desempeño: e.target.value }))}
            placeholder="Precargado desde la solicitud / vacante"
          />
        </label>
        <label className={labelClass}>
          Nivel tabulador (1–9)
          <div className="flex gap-2">
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.tabulador_nivel}
              onChange={(e) => setForm((f) => ({ ...f, tabulador_nivel: e.target.value.replace(/\D/g, '').slice(0, 1) }))}
              placeholder="5"
            />
            <button
              type="button"
              onClick={aplicarSalarioDesdeNivel}
              className="shrink-0 rounded-lg border border-orange-500/40 px-3 text-xs font-semibold text-orange-200 hover:bg-orange-500/10"
            >
              SB tabulador
            </button>
          </div>
        </label>
        <label className={labelClass}>
          Salario básico diario (VES)
          <input
            className={inputClass}
            value={form.salario_basico_diario_ves}
            onChange={(e) => setForm((f) => ({ ...f, salario_basico_diario_ves: e.target.value }))}
            placeholder="Desde tabulador o manual"
          />
        </label>
        <label className={labelClass}>
          Forma de pago
          <select
            className={inputClass}
            value={form.forma_pago}
            onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value }))}
          >
            <option value="">— Seleccionar —</option>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="pago_movil">Pago móvil</option>
          </select>
        </label>
        <label className={labelClass}>
          Lugar / detalle de pago (banco, ref., etc.)
          <input
            className={inputClass}
            value={form.lugar_pago}
            onChange={(e) => setForm((f) => ({ ...f, lugar_pago: e.target.value }))}
            placeholder="Ej. Banco Venezuela — cuenta nómina"
          />
        </label>
        <label className={labelClass}>
          Jornada de trabajo
          <select
            className={inputClass}
            value={form.jornada_trabajo}
            onChange={(e) => setForm((f) => ({ ...f, jornada_trabajo: e.target.value }))}
          >
            <option value="">— Seleccionar —</option>
            <option value="diurna">Diurna</option>
            <option value="nocturna">Nocturna</option>
            <option value="mixta">Mixta</option>
          </select>
        </label>
        <label className={`sm:col-span-2 ${labelClass}`}>
          Lugar de prestación del servicio
          <input
            className={inputClass}
            value={form.lugar_prestacion_servicio}
            onChange={(e) => setForm((f) => ({ ...f, lugar_prestacion_servicio: e.target.value }))}
            placeholder="Proyecto / obra y ubicación"
          />
        </label>
        <label className={labelClass}>
          Nº oficio tabulador (Gaceta)
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.numero_oficio_tabulador}
              onChange={(e) => setForm((f) => ({ ...f, numero_oficio_tabulador: e.target.value }))}
              placeholder="ej. 5.1"
            />
            <button
              type="button"
              onClick={sincronizarDenominacionGaceta}
              className="shrink-0 rounded-lg border border-orange-500/40 px-3 text-xs font-semibold text-orange-200 hover:bg-orange-500/10"
            >
              Denominación
            </button>
          </div>
        </label>
        <label className={labelClass}>
          Denominación oficial (Gaceta)
          <input
            className={inputClass}
            value={form.gaceta_denominacion_oficio}
            onChange={(e) => setForm((f) => ({ ...f, gaceta_denominacion_oficio: e.target.value }))}
            placeholder="Texto del tabulador"
          />
        </label>
        <label className={`sm:col-span-2 ${labelClass}`}>
          Objeto del contrato
          <textarea
            rows={4}
            className={`${inputClass} resize-y`}
            value={form.objeto_contrato}
            onChange={(e) => setForm((f) => ({ ...f, objeto_contrato: e.target.value }))}
            placeholder="Descripción del objeto contractual según oficio"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar datos laborales
        </button>
      </div>
    </section>
  );
}
