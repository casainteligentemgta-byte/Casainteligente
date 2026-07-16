import { NextResponse } from 'next/server';
import { sugerirHerramientasEInsumosProyecto } from '@/lib/proyectos/geminiSugerirKit';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      proyecto?: { nombre?: string; ubicacion?: string; observaciones?: string | null };
      inventarioActual?: Array<{ nombre?: string; marca?: string | null; modelo?: string | null; cantidad?: number | null }>;
    };

    const nombre = body.proyecto?.nombre?.trim();
    const ubicacion = body.proyecto?.ubicacion?.trim();
    if (!nombre || !ubicacion) {
      return NextResponse.json({ error: 'Faltan datos del proyecto.' }, { status: 400 });
    }

    const inventario = Array.isArray(body.inventarioActual) ? body.inventarioActual : [];
    const resultado = await sugerirHerramientasEInsumosProyecto({
      proyecto: {
        nombre,
        ubicacion,
        observaciones: body.proyecto?.observaciones ?? null,
      },
      inventarioActual: inventario
        .map((x) => ({
          nombre: x.nombre?.trim() ?? '',
          marca: x.marca ?? null,
          modelo: x.modelo ?? null,
          cantidad: typeof x.cantidad === 'number' ? x.cantidad : null,
        }))
        .filter((x) => x.nombre.length > 0),
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('[POST /api/proyectos/sugerir-kit]', error);
    return NextResponse.json({ error: 'Error interno al sugerir kit.' }, { status: 500 });
  }
}
