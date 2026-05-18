'use client';



import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { hrefSolicitudPersonalObrero } from '@/lib/rrhh/hrefSolicitudPersonal';

import { useEffect, useMemo, useState } from 'react';

import RrhhSubnavEnlaces from '@/components/rrhh/RrhhSubnavEnlaces';

import ResumenObrerosProyectoModulo from '@/components/proyectos/ResumenObrerosProyectoModulo';

import { loadProyectosSmartRrhhHojasVida, type ProyectoModuloIntegral } from '@/lib/proyectos/proyectosUnificados';

import { createClient } from '@/lib/supabase/client';



/** '' = todos los proyectos SMART; uuid = una obra concreta. */

type AlcanceObra = string;



export default function RrhhHojasVidaPage() {

  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [proyectosModulo, setProyectosModulo] = useState<ProyectoModuloIntegral[]>([]);

  const [alcanceObra, setAlcanceObra] = useState<AlcanceObra>('');

  const [cargandoProyectos, setCargandoProyectos] = useState(true);

  const [errorProyectos, setErrorProyectos] = useState<string | null>(null);



  const mostrarOpcionTodos = proyectosModulo.length > 1;



  const proyectoModuloIdsActivos = useMemo(() => {

    if (!proyectosModulo.length) return [];

    if (alcanceObra) return [alcanceObra];

    return proyectosModulo.map((p) => p.id);

  }, [alcanceObra, proyectosModulo]);



  const proyectoModuloIdPrincipal = proyectoModuloIdsActivos[0] ?? '';

  const proyectoModuloIdFiltroEnlaces = alcanceObra || null;



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

      setProyectosModulo(proyectos);

      setAlcanceObra((prev) => {

        if (prev && proyectos.some((p) => p.id === prev)) return prev;

        if (proyectos.length <= 1) return proyectos[0]?.id ?? '';

        return '';

      });

      if (errors.length) setErrorProyectos(errors.join(' · '));

      setCargandoProyectos(false);

    })();

    return () => {

      alive = false;

    };

  }, [supabase]);



  const resumenKey = proyectoModuloIdsActivos.join(',') || 'sin-proyecto';



  return (

    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">

      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente</p>

      <h1 className="text-2xl font-bold tracking-tight text-white">RRHH</h1>



      <header className="mb-6 mt-8">

        <RrhhSubnavEnlaces

          proyectoModuloId={proyectoModuloIdFiltroEnlaces ?? (proyectoModuloIdPrincipal || null)}

        />

      </header>



      {cargandoProyectos ? (

        <p className="mb-8 text-sm text-zinc-500">Cargando cuadro SMART RRHH…</p>

      ) : proyectoModuloIdsActivos.length > 0 ? (

        <div className="mb-10">

          {errorProyectos ? (

            <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-xs text-amber-100/90">

              {errorProyectos}

            </p>

          ) : null}



          <ResumenObrerosProyectoModulo

            key={resumenKey}

            proyectoModuloId={proyectoModuloIdPrincipal}

            proyectosModuloIds={mostrarOpcionTodos && !alcanceObra ? proyectosModulo.map((p) => p.id) : undefined}

            proyectoModuloIdFiltroEnlaces={proyectoModuloIdFiltroEnlaces}

            tabUrl="rrhh"

            tituloSeccion="SMART RRHH"

            subtituloSeccion={null}

            ocultarEnlaceHojasVida

            selectorObra={{

              valor: alcanceObra,

              onChange: setAlcanceObra,

              opciones: proyectosModulo,

              mostrarTodos: mostrarOpcionTodos,

            }}

          />

        </div>

      ) : (

        <p className="mb-8 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">

          No se encontró un proyecto módulo integral para el cuadro SMART RRHH.

          {errorProyectos ? ` ${errorProyectos}` : null} Crea un proyecto en{' '}

          <Link href="/proyectos/modulo" className="font-semibold text-amber-200 underline underline-offset-2">

            Proyectos

          </Link>

          .

        </p>

      )}

    </div>

  );

}


