'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Briefcase } from 'lucide-react';
import ListaEmpleosHojasVida from '@/app/rrhh/hojas-vida/components/ListaEmpleosHojasVida';
import ModalNuevaVacante from '@/app/proyectos/modulo/[id]/components/ModalNuevaVacante';
import RrhhSubnavEnlaces, { rrhhSubnavBtnClass } from '@/components/rrhh/RrhhSubnavEnlaces';
import ResumenObrerosProyectoModulo from '@/components/proyectos/ResumenObrerosProyectoModulo';
import SugerenciaCuadrilla from '@/components/proyectos/SugerenciaCuadrilla';
import CuadroNominaContratados from '@/components/nomina/CuadroNominaContratados';
import {
  entidadIdPredominante,
  loadProyectosModuloIntegralPorEntidad,
  loadProyectosSmartRrhhHojasVida,
  type ProyectoModuloIntegral,
} from '@/lib/proyectos/proyectosUnificados';
import { hrefSolicitudPersonalObrero } from '@/lib/rrhh/hrefSolicitudPersonal';
import {
  guardarProyectoRrhhContexto,
  leerProyectoRrhhContexto,
} from '@/lib/rrhh/proyectoRrhhContexto';
import { createClient } from '@/lib/supabase/client';

/** '' = todos los proyectos de la misma entidad de trabajo; uuid = una obra concreta. */
type AlcanceObra = string;

/**
 * RRHH unificado: hub del menú inferior + RRHH del proyecto (vacantes, cuadro, nómina, cuadrilla).
 */
export default function RrhhHojasVidaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proyectoModuloQuery = (searchParams.get('proyecto_modulo') ?? searchParams.get('proyecto') ?? '').trim();
  const supabase = useMemo(() => createClient(), []);
  const [proyectosModulo, setProyectosModulo] = useState<ProyectoModuloIntegral[]>([]);
  const [alcanceObra, setAlcanceObra] = useState<AlcanceObra>(proyectoModuloQuery);
  const [cargandoProyectos, setCargandoProyectos] = useState(true);
  const [errorProyectos, setErrorProyectos] = useState<string | null>(null);
  const [entidadIdAlcance, setEntidadIdAlcance] = useState<string | null>(null);
  const [entidadNombreAlcance, setEntidadNombreAlcance] = useState<string | null>(null);
  const [proyectoIdsEntidadTodos, setProyectoIdsEntidadTodos] = useState<string[]>([]);
  const [vacanteOpen, setVacanteOpen] = useState(false);
  const [vacantesTick, setVacantesTick] = useState(0);

  const mostrarOpcionTodos = proyectosModulo.length > 1;

  const proyectoModuloIdsActivos = useMemo(() => {
    if (!proyectosModulo.length) return [];
    if (alcanceObra) return [alcanceObra];
    if (proyectoIdsEntidadTodos.length > 0) return proyectoIdsEntidadTodos;
    return proyectosModulo.map((p) => p.id);
  }, [alcanceObra, proyectosModulo, proyectoIdsEntidadTodos]);

  const proyectoModuloIdPrincipal = proyectoModuloIdsActivos[0] ?? '';
  const proyectoModuloIdFiltroEnlaces = alcanceObra || null;
  const obraSeleccionada = useMemo(
    () => proyectosModulo.find((p) => p.id === (alcanceObra || proyectoModuloIdPrincipal)) ?? null,
    [proyectosModulo, alcanceObra, proyectoModuloIdPrincipal],
  );

  const etiquetaTodosSelector = useMemo(() => {
    if (entidadNombreAlcance) return `Todos · ${entidadNombreAlcance}`;
    return 'Todos (misma entidad de trabajo)';
  }, [entidadNombreAlcance]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === '#solicitud-personal' || hash === '#oficio-cantidad') {
      router.replace(
        hrefSolicitudPersonalObrero({
          proyectoModuloId: proyectoModuloIdFiltroEnlaces ?? (proyectoModuloIdPrincipal || null),
        }),
      );
    }
  }, [router, proyectoModuloIdFiltroEnlaces, proyectoModuloIdPrincipal]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setCargandoProyectos(true);
      setErrorProyectos(null);
      const { proyectos, errors } = await loadProyectosSmartRrhhHojasVida(supabase);
      if (!alive) return;

      let lista = proyectos;
      const urlId = proyectoModuloQuery;
      // Si la URL apunta a un proyecto concreto, forzar ese alcance e incluirlo aunque no estuviera en el listado.
      if (urlId && !lista.some((p) => p.id === urlId)) {
        const { data: extra } = await supabase
          .from('ci_proyectos')
          .select('id,nombre,entidad_id,tipo_proyecto')
          .eq('id', urlId)
          .maybeSingle();
        if (!alive) return;
        const row = extra as {
          id?: string;
          nombre?: string | null;
          entidad_id?: string | null;
          tipo_proyecto?: string | null;
        } | null;
        if (row?.id) {
          lista = [
            ...lista,
            {
              id: row.id,
              nombre: (row.nombre ?? '').trim() || 'Sin nombre',
              entidad_id: row.entidad_id ?? null,
            },
          ];
        }
      }

      setProyectosModulo(lista);
      setAlcanceObra((prev) => {
        // URL con proyecto concreto: nunca degradar a «Todos» ni a otra obra.
        if (urlId) return urlId;
        if (prev && lista.some((p) => p.id === prev)) return prev;
        // Última obra de RRHH/Express (p. ej. Asfaltado), no forzar Flamboyant por orden.
        const stored = leerProyectoRrhhContexto();
        if (stored && lista.some((p) => p.id === stored)) return stored;
        if (lista.length <= 1) return lista[0]?.id ?? '';
        return lista[0]?.id ?? '';
      });
      if (errors.length) setErrorProyectos(errors.join(' · '));
      setCargandoProyectos(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, proyectoModuloQuery]);

  useEffect(() => {
    if (cargandoProyectos) return;
    guardarProyectoRrhhContexto(alcanceObra || null);
    const actual = (searchParams.get('proyecto_modulo') ?? '').trim();
    if (alcanceObra === actual) return;
    const params = new URLSearchParams(searchParams.toString());
    if (alcanceObra) params.set('proyecto_modulo', alcanceObra);
    else params.delete('proyecto_modulo');
    params.delete('proyecto');
    const q = params.toString();
    router.replace(q ? `/rrhh/hojas-vida?${q}` : '/rrhh/hojas-vida', { scroll: false });
  }, [alcanceObra, cargandoProyectos, router, searchParams]);

  useEffect(() => {
    const eid = entidadIdPredominante(proyectosModulo);
    if (!eid) {
      setEntidadIdAlcance(null);
      setEntidadNombreAlcance(null);
      setProyectoIdsEntidadTodos([]);
      return;
    }
    let alive = true;
    void (async () => {
      const [{ proyectos, errors }, entRes] = await Promise.all([
        loadProyectosModuloIntegralPorEntidad(supabase, eid),
        supabase.from('ci_entidades').select('nombre').eq('id', eid).maybeSingle(),
      ]);
      if (!alive) return;
      setEntidadIdAlcance(eid);
      setEntidadNombreAlcance(
        ((entRes.data as { nombre?: string | null } | null)?.nombre ?? '').trim() || null,
      );
      if (errors.length && !proyectos.length) {
        setProyectoIdsEntidadTodos(proyectosModulo.map((p) => p.id));
        return;
      }
      setProyectoIdsEntidadTodos(proyectos.map((p) => p.id));
    })();
    return () => {
      alive = false;
    };
  }, [supabase, proyectosModulo]);

  const resumenKey = proyectoModuloIdsActivos.join(',') || 'sin-proyecto';
  const proyectoEmpleosId = alcanceObra || proyectoModuloIdPrincipal;
  const mostrarListaEmpleos = Boolean(proyectoEmpleosId) && proyectoModuloIdsActivos.length <= 1;
  const obraUnicaId = alcanceObra || (proyectosModulo.length === 1 ? proyectoModuloIdPrincipal : '');
  const puedeAccionesObra = Boolean(obraUnicaId);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente</p>
      <h1 className="text-2xl font-bold tracking-tight text-white">RRHH</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Personal de obra: vacantes, cuadro, reclutamiento y nómina del proyecto seleccionado.
      </p>

      <header className="mb-6 mt-6">
        <RrhhSubnavEnlaces
          proyectoModuloId={
            // Preferir la obra elegida en el selector; si está en «Todos», usar contexto guardado.
            proyectoModuloIdFiltroEnlaces || null
          }
          accionesObra={
            puedeAccionesObra ? (
              <>
                <button
                  type="button"
                  onClick={() => setVacanteOpen(true)}
                  className={`${rrhhSubnavBtnClass} border-[#FF9500]/45 bg-gradient-to-r from-[#FFD60A]/15 to-[#FF9500]/15 text-[#FFD60A] hover:from-[#FFD60A]/25 hover:to-[#FF9500]/25`}
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">Nueva vacante</span>
                </button>
                {obraSeleccionada ? (
                  <Link
                    href={`/proyectos/modulo/${encodeURIComponent(obraUnicaId)}`}
                    className={`${rrhhSubnavBtnClass} border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10`}
                  >
                    <span className="truncate">Ficha del proyecto</span>
                  </Link>
                ) : null}
              </>
            ) : null
          }
        />
      </header>

      {cargandoProyectos ? (
        <p className="mb-8 text-sm text-zinc-500">Cargando RRHH del proyecto…</p>
      ) : proyectoModuloIdsActivos.length > 0 ? (
        <div className="mb-10 space-y-8">
          {errorProyectos ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-xs text-amber-100/90">
              {errorProyectos}
            </p>
          ) : null}
          {!alcanceObra && entidadNombreAlcance ? (
            <p className="text-xs text-zinc-500">
              «{etiquetaTodosSelector}» suma solicitados de todos los proyectos del módulo integral
              vinculados a la entidad de trabajo{' '}
              <span className="font-semibold text-zinc-300">{entidadNombreAlcance}</span>
              {proyectoIdsEntidadTodos.length > proyectosModulo.length
                ? ` (${proyectoIdsEntidadTodos.length} proyectos)`
                : ''}
              .
            </p>
          ) : null}

          {mostrarListaEmpleos ? (
            <ListaEmpleosHojasVida proyectoModuloId={proyectoEmpleosId} />
          ) : null}

          <ResumenObrerosProyectoModulo
            key={resumenKey}
            proyectoModuloId={proyectoModuloIdPrincipal}
            proyectosModuloIds={
              proyectoModuloIdsActivos.length > 1 ? proyectoModuloIdsActivos : undefined
            }
            proyectoModuloIdFiltroEnlaces={proyectoModuloIdFiltroEnlaces}
            entidadIdAlcance={!alcanceObra ? entidadIdAlcance : null}
            listaRefresco={vacantesTick}
            tabUrl="rrhh"
            tituloSeccion="RRHH del proyecto"
            subtituloSeccion={null}
            ocultarEnlaceHojasVida
            ocultarIngenieroResidente
            selectorObra={{
              valor: alcanceObra,
              onChange: setAlcanceObra,
              opciones: proyectosModulo,
              mostrarTodos: mostrarOpcionTodos,
              etiquetaTodos: etiquetaTodosSelector,
            }}
          />

          {obraUnicaId && obraSeleccionada ? (
            <>
              <div id="nomina" className="scroll-mt-24">
                <CuadroNominaContratados
                  proyectoModuloId={obraUnicaId}
                  titulo="Contratados activos"
                />
              </div>
              <div id="equipo-recomendado" className="scroll-mt-24">
                <SugerenciaCuadrilla
                  nombreObra={obraSeleccionada.nombre}
                  ubicacionObra=""
                  proyectoModuloId={obraUnicaId}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className="mb-8 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          No se encontró un proyecto módulo integral para RRHH.
          {errorProyectos ? ` ${errorProyectos}` : null} Crea un proyecto en{' '}
          <Link href="/proyectos/modulo" className="font-semibold text-amber-200 underline underline-offset-2">
            Proyectos
          </Link>
          .
        </p>
      )}

      {obraUnicaId ? (
        <ModalNuevaVacante
          open={vacanteOpen}
          onClose={() => setVacanteOpen(false)}
          proyectoModuloId={obraUnicaId}
          proyectoNombre={obraSeleccionada?.nombre ?? null}
          onVacanteCreada={() => setVacantesTick((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
