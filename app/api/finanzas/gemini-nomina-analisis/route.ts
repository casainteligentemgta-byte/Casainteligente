import { NextResponse } from 'next/server';
import { analizarDistribucionNivelesNominaGemini } from '@/lib/finanzas/geminiAnalisisNivelesNomina';

export async function POST(req: Request) {
  let body: {
    presupuestoManoObraVES?: number;
    costoRealMesVES?: number;
    añoMes?: string;
    distribucionPorNivel?: Record<string, number>;
    filasResumidas?: Array<{ nombre: string; nivel: number; totalMesVES: number }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const presupuestoManoObraVES = Number(body.presupuestoManoObraVES);
  const costoRealMesVES = Number(body.costoRealMesVES);
  const añoMes = (body.añoMes ?? '').trim() || new Date().toISOString().slice(0, 7);
  const distribucionPorNivel = body.distribucionPorNivel ?? {};
  const filasResumidas = Array.isArray(body.filasResumidas) ? body.filasResumidas : [];

  if (!Number.isFinite(presupuestoManoObraVES) || !Number.isFinite(costoRealMesVES)) {
    return NextResponse.json({ error: 'presupuestoManoObraVES y costoRealMesVES numéricos requeridos' }, { status: 400 });
  }

  try {
    const out = await analizarDistribucionNivelesNominaGemini({
      presupuestoManoObraVES,
      costoRealMesVES,
      añoMes,
      distribucionPorNivel,
      filasResumidas,
    });
    return NextResponse.json(out);
  } catch (e) {
    console.error('[finanzas/gemini-nomina-analisis]', e);
    return NextResponse.json({ error: 'Error al consultar Gemini' }, { status: 500 });
  }
}
