'use client';

import type { CSSProperties } from 'react';
import { useCallback, useState } from 'react';
import type { MotivoRetiro, ResultadoLiquidacionConstruccion } from '@/lib/construccion/liquidacion/types';
import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

const MOTIVOS: { id: MotivoRetiro; label: string }[] = [
  { id: 'renuncia', label: 'Renuncia' },
  { id: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
  { id: 'despido_justificado', label: 'Despido justificado' },
  { id: 'despido_injustificado', label: 'Despido injustificado' },
  { id: 'transferencia', label: 'Transferencia (Cl. 13)' },
  { id: 'cierre_obra', label: 'Cierre de obra' },
  { id: 'otro', label: 'Otro' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function SimularLiquidacionConstruccion() {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaEgreso, setFechaEgreso] = useState('');
  const [nivel, setNivel] = useState('5');
  const [salarioManual, setSalarioManual] = useState('');
  const [motivo, setMotivo] = useState<MotivoRetiro>('renuncia');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLiquidacionConstruccion | null>(null);
  const [finiquito, setFiniquito] = useState<string | null>(null);
  const [finiquitoGemini, setFiniquitoGemini] = useState(false);
  const [aceptoRevision, setAceptoRevision] = useState(false);

  const salarioDesdeFormulario = () => {
    const m = salarioManual.trim();
    if (m !== '') {
      const v = Number(m.replace(',', '.'));
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    const nv = Number(nivel);
    if (nv >= 1 && nv <= 9) return SALARIO_BASICO_DIARIO_VES_POR_NIVEL[nv - 1] ?? 0;
    return 0;
  };

  const simular = useCallback(async () => {
    setError(null);
    setCargando(true);
    setFiniquito(null);
    setFiniquitoGemini(false);
    setAceptoRevision(false);
    const ultimo = salarioDesdeFormulario();
    try {
      const res = await fetch('/api/construccion/liquidacion/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaIngreso,
          fechaEgreso,
          ultimoSalarioBasicoDiarioVES: ultimo,
          nivelSalario: Number(nivel),
          motivoRetiro: motivo,
          nombreEmpleado: nombre.trim() || undefined,
          redactarFiniquito: false,
        }),
      });
      const data = (await res.json()) as { resultado?: ResultadoLiquidacionConstruccion; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al simular');
        setResultado(null);
        return;
      }
      setResultado(data.resultado ?? null);
    } catch {
      setError('No se pudo conectar.');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [fechaIngreso, fechaEgreso, nivel, salarioManual, motivo, nombre]);

  const generarFiniquito = useCallback(async () => {
    if (!resultado) return;
    setError(null);
    setCargando(true);
    setAceptoRevision(false);
    const ultimo = salarioDesdeFormulario();
    try {
      const res = await fetch('/api/construccion/liquidacion/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaIngreso,
          fechaEgreso,
          ultimoSalarioBasicoDiarioVES: ultimo,
          nivelSalario: Number(nivel),
          motivoRetiro: motivo,
          nombreEmpleado: nombre.trim() || undefined,
          redactarFiniquito: true,
        }),
      });
      const data = (await res.json()) as {
        resultado?: ResultadoLiquidacionConstruccion;
        documentoFiniquito?: string | null;
        finiquitoGeneradoConGemini?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Error');
        setFiniquito(null);
        setFiniquitoGemini(false);
        return;
      }
      if (data.resultado) setResultado(data.resultado);
      setFiniquito(data.documentoFiniquito ?? null);
      setFiniquitoGemini(Boolean(data.finiquitoGeneradoConGemini));
      if (!data.finiquitoGeneradoConGemini) {
        setError('No se obtuvo borrador con Gemini.');
        setFiniquito(null);
      }
    } catch {
      setError('No se pudo generar el finiquito.');
    } finally {
      setCargando(false);
    }
  }, [resultado, fechaIngreso, fechaEgreso, nivel, salarioManual, motivo, nombre]);

  const confirmar = useCallback(() => {
    if (!finiquito || !aceptoRevision || !finiquitoGemini) return;
    window.alert(
      'Simulación registrada localmente (demo). Integre con contabilidad y archivo legal antes de pago real.',
    );
  }, [finiquito, aceptoRevision, finiquitoGemini]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          padding: '0.65rem 1.1rem',
          background: 'var(--accent)',
          color: '#0d1117',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Simular liquidación
      </button>
    );
  }

  return (
    <section
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        border: '1px solid hsl(var(--border))',
        borderRadius: '10px',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Egreso y liquidación (construcción)</h2>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setResultado(null);
            setFiniquito(null);
            setAceptoRevision(false);
          }}
          style={{ fontSize: '0.85rem', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
        >
          Cerrar
        </button>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
        Referencia convencional: Cl. 12 (índole de labores) y Cl. 13 (transferencia). Cálculos monetarios: prestaciones
        (desglose mensual), intereses simulados, vacaciones Cl. 47, utilidades Cl. 48. Obligatorio revisión legal antes de
        pago.
      </p>

      <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
          Nombre del trabajador(a)
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={inp}
            placeholder="Opcional"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
          Fecha de ingreso
          <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} style={inp} required />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
          Fecha de egreso
          <input type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} style={inp} required />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
          Nivel tabulador (1–9) — salario básico diario
          <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={inp}>
            {SALARIO_BASICO_DIARIO_VES_POR_NIVEL.map((sb, i) => (
              <option key={i + 1} value={String(i + 1)}>
                Nivel {i + 1} — {fmt(sb)} VES/día
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
          Salario básico diario manual (opcional; anula el del nivel)
          <input
            value={salarioManual}
            onChange={(e) => setSalarioManual(e.target.value)}
            style={inp}
            placeholder="Vacío = usar nivel"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
          Motivo de retiro
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoRetiro)} style={inp}>
            {MOTIVOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p style={{ color: '#f85149', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{error}</p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          disabled={cargando || !fechaIngreso || !fechaEgreso}
          onClick={() => void simular()}
          style={{ ...btnPrimary, opacity: cargando || !fechaIngreso || !fechaEgreso ? 0.5 : 1 }}
        >
          {cargando ? 'Procesando…' : 'Simular liquidación'}
        </button>
        <button
          type="button"
          disabled={cargando || !resultado}
          onClick={() => void generarFiniquito()}
          style={{ ...btnSecondary, opacity: cargando || !resultado ? 0.5 : 1 }}
        >
          Redactar documento de finiquito (Gemini)
        </button>
      </div>

      {resultado ? (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Resultado (JSON resumido)</h3>
          <pre
            style={{
              fontSize: '0.72rem',
              overflow: 'auto',
              maxHeight: '220px',
              padding: '0.75rem',
              background: 'var(--bg)',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {JSON.stringify(
              {
                granTotalVES: resultado.granTotalVES,
                entrada: resultado.entrada,
                resumenLineas: resultado.resumenLineas,
                prestacionesMeses: resultado.prestacionesSociales.desglosePorMes.length,
                meta: resultado.meta,
              },
              null,
              2,
            )}
          </pre>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.5rem' }}>
            Gran total (referencial): {fmt(resultado.granTotalVES)} VES
          </p>
        </div>
      ) : null}

      {finiquito ? (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.35rem' }}>Documento de finiquito (Gemini)</h3>
          <textarea readOnly value={finiquito} rows={14} style={{ ...inp, width: '100%', fontFamily: 'monospace', fontSize: '0.78rem' }} />
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={aceptoRevision} onChange={(e) => setAceptoRevision(e.target.checked)} />
            Confirmo que el borrador fue revisado y que el finiquito debe ser validado legalmente antes de firma del trabajador.
          </label>
          <button
            type="button"
            disabled={!aceptoRevision || !finiquitoGemini}
            onClick={confirmar}
            style={{
              ...btnPrimary,
              marginTop: '0.65rem',
              opacity: !aceptoRevision || !finiquitoGemini ? 0.45 : 1,
            }}
          >
            Confirmar simulación
          </button>
        </div>
      ) : null}
    </section>
  );
}

const inp: CSSProperties = {
  padding: '0.45rem 0.5rem',
  borderRadius: '6px',
  border: '1px solid hsl(var(--border))',
  background: 'var(--bg)',
  color: 'inherit',
};

const btnPrimary: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--accent)',
  color: '#0d1117',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  background: 'var(--bg)',
  color: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};
