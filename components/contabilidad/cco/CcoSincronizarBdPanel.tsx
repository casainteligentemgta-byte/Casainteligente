'use client';

import React, { useState } from 'react';
import { Loader2, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CcoSincronizarBdPanel({
  proyectoId,
  onDone,
}: {
  proyectoId: string;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensaje?: string;
    error?: string;
    borrados?: number;
    insertados?: number;
  } | null>(null);

  const handleSincronizar = async () => {
    if (!proyectoId) {
      alert('Debes seleccionar una obra primero en la barra superior.');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres sincronizar? Esto reemplazará todos los registros actuales de esta obra con los datos de la base de datos principal.')) {
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const res = await fetch('/api/contabilidad/cco/sincronizar-bd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId }),
      });

      const json = await res.json();
      
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Error desconocido al sincronizar');
      }

      setResultado({
        ok: true,
        mensaje: json.mensaje,
        borrados: json.registros_borrados,
        insertados: json.registros_insertados,
      });

      // Esperar un momento para que el usuario lea el mensaje antes de cerrar
      setTimeout(() => {
        onDone();
      }, 3000);

    } catch (err) {
      setResultado({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: 24,
        marginBottom: 20,
        maxWidth: 600,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Database size={24} color="#2563EB" />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          Sincronizar con Base de Datos Principal
        </h2>
      </div>

      <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        Esta opción se conecta directamente a la base de datos maestra (la de tu suegro) y descarga todas las transacciones correspondientes. 
        <br /><br />
        <strong>Nota:</strong> Esta acción reemplazará todos los registros actuales en tu libro maestro para la obra seleccionada.
      </p>

      {resultado && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            background: resultado.ok ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${resultado.ok ? '#BBF7D0' : '#FECACA'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          {resultado.ok ? (
            <CheckCircle2 size={20} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
          ) : (
            <AlertCircle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: resultado.ok ? '#166534' : '#991B1B' }}>
              {resultado.ok ? '¡Sincronización Exitosa!' : 'Error en la sincronización'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: resultado.ok ? '#15803D' : '#B91C1C' }}>
              {resultado.ok 
                ? `Se borraron ${resultado.borrados} registros antiguos y se insertaron ${resultado.insertados} registros nuevos. Actualizando dashboard...` 
                : resultado.error}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleSincronizar}
        disabled={loading || !proyectoId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: loading || !proyectoId ? '#94A3B8' : '#2563EB',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 15,
          cursor: loading || !proyectoId ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Sincronizando...
          </>
        ) : (
          <>
            <Database size={18} />
            Iniciar Sincronización
          </>
        )}
      </button>
      
      {!proyectoId && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
          Debes seleccionar una obra en la barra superior para poder sincronizar.
        </p>
      )}
    </div>
  );
}
