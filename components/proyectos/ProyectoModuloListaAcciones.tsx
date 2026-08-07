'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import ModalBotUsuariosProyecto from '@/components/proyectos/ModalBotUsuariosProyecto';
import ModalConfigFastTrack from '@/components/proyectos/ModalConfigFastTrack';
import { hrefCcoProyecto } from '@/lib/contabilidad/cco/hrefCcoProyecto';

type Origen = 'modulo' | 'obra_talento';

type Props = {
  id: string;
  nombre: string;
  origen: Origen;
  limiteFastTrackUsd: number;
  deleting: boolean;
  onBorrar: () => void;
  onGuardadoFastTrack: (limite: number) => void;
};

const btnSecundario: CSSProperties = {
  flex: '1 1 0',
  width: 0,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  background: '#F8FAFC',
  color: '#334155',
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  padding: '9px 8px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const menuItemBase: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  color: '#0F172A',
  padding: '10px 12px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

/**
 * Acciones de tarjeta en lista de proyectos: CTA + 3 módulos + menú ···
 * Variante fondo blanco.
 */
export default function ProyectoModuloListaAcciones({
  id,
  nombre,
  origen,
  limiteFastTrackUsd,
  deleting,
  onBorrar,
  onGuardadoFastTrack,
}: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const esModulo = origen === 'modulo';
  const hrefPrincipal = esModulo ? `/proyectos/modulo/${id}` : `/proyectos/${id}/finanzas`;

  useEffect(() => {
    if (!menuAbierto) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuAbierto]);

  return (
    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <Link href={hrefPrincipal} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
          <button
            type="button"
            style={{
              width: '100%',
              background: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {esModulo ? 'Abrir gestión' : 'Abrir finanzas'}
          </button>
        </Link>
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            aria-expanded={menuAbierto}
            aria-controls={menuId}
            aria-haspopup="menu"
            aria-label="Más acciones del proyecto"
            onClick={() => setMenuAbierto((v) => !v)}
            style={{
              width: '42px',
              height: '100%',
              minHeight: '40px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: menuAbierto ? '#F1F5F9' : '#FFFFFF',
              color: '#334155',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ···
          </button>
          {menuAbierto ? (
            <div
              id={menuId}
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 'calc(100% + 6px)',
                zIndex: 40,
                minWidth: '200px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '6px',
                boxShadow: '0 14px 32px rgba(15,23,42,0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {esModulo ? (
                <Link
                  href={`/proyectos/modulo/${id}/control-obra/equipo`}
                  role="menuitem"
                  onClick={() => setMenuAbierto(false)}
                  style={menuItemBase}
                >
                  Equipo
                </Link>
              ) : null}
              <Link
                href={`/proyectos/modulo/${id}/control-obra/tours`}
                role="menuitem"
                onClick={() => setMenuAbierto(false)}
                style={menuItemBase}
              >
                Tours 3D
              </Link>
              {esModulo ? (
                <Link
                  href={`/proyectos/modulo/${id}?editar=1`}
                  role="menuitem"
                  onClick={() => setMenuAbierto(false)}
                  style={menuItemBase}
                >
                  Modificar datos
                </Link>
              ) : null}
              {esModulo ? (
                <div role="none" style={{ padding: '2px 0' }}>
                  <ModalBotUsuariosProyecto
                    proyectoId={id}
                    proyectoNombre={nombre}
                    triggerClassName="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-700 hover:bg-slate-50"
                  />
                </div>
              ) : null}
              {esModulo ? (
                <div role="none" style={{ padding: '2px 0' }}>
                  <ModalConfigFastTrack
                    proyectoId={id}
                    proyectoNombre={nombre}
                    limiteInicial={limiteFastTrackUsd}
                    onGuardado={onGuardadoFastTrack}
                    triggerLabel="Configuración"
                    triggerClassName="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                  />
                </div>
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={deleting}
                onClick={() => {
                  setMenuAbierto(false);
                  onBorrar();
                }}
                style={{
                  ...menuItemBase,
                  color: '#DC2626',
                  opacity: deleting ? 0.6 : 1,
                  cursor: deleting ? 'wait' : 'pointer',
                }}
              >
                {deleting ? 'Borrando…' : 'Borrar proyecto'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '6px',
          width: '100%',
        }}
      >
        {esModulo ? (
          <Link
            href={`/rrhh/hojas-vida?proyecto_modulo=${encodeURIComponent(id)}`}
            title="RRHH del proyecto"
            style={btnSecundario}
          >
            RRHH
          </Link>
        ) : null}
        {esModulo ? (
          <Link href={hrefCcoProyecto(id)} title="Control Contable de Obra" style={btnSecundario}>
            Finanzas
          </Link>
        ) : null}
        <Link href={`/proyectos/modulo/${id}/control-obra`} style={btnSecundario}>
          {esModulo ? 'Control' : 'Control de obra'}
        </Link>
      </div>
    </div>
  );
}
