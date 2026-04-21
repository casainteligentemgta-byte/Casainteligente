import { NextResponse } from 'next/server';
import { CalculadoraLiquidacionConstruccion } from '@/lib/construccion/liquidacion/CalculadoraLiquidacionConstruccion';
import { redactarDocumentoFiniquitoConGemini } from '@/lib/construccion/liquidacion/geminiFiniquito';
import type { LiquidacionConstruccionInput, MotivoRetiro } from '@/lib/construccion/liquidacion/types';

const MOTIVOS: MotivoRetiro[] = [
  'renuncia',
  'mutuo_acuerdo',
  'despido_justificado',
  'despido_injustificado',
  'transferencia',
  'cierre_obra',
  'otro',
];

function esMotivo(v: unknown): v is MotivoRetiro {
  return typeof v === 'string' && (MOTIVOS as string[]).includes(v);
}

/**
 * POST: simula liquidación de construcción y opcionalmente redacta finiquito con Gemini.
 */
export async function POST(req: Request) {
  let body: {
    fechaIngreso?: string;
    fechaEgreso?: string;
    ultimoSalarioBasicoDiarioVES?: number;
    nivelSalario?: number;
    motivoRetiro?: string;
    nombreEmpleado?: string;
    redactarFiniquito?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.fechaIngreso || !body.fechaEgreso || !esMotivo(body.motivoRetiro)) {
    return NextResponse.json(
      { error: 'fechaIngreso, fechaEgreso y motivoRetiro válidos son requeridos.' },
      { status: 400 },
    );
  }

  const sal =
    body.ultimoSalarioBasicoDiarioVES != null && Number.isFinite(body.ultimoSalarioBasicoDiarioVES)
      ? Number(body.ultimoSalarioBasicoDiarioVES)
      : 0;

  const input: LiquidacionConstruccionInput = {
    fechaIngreso: body.fechaIngreso,
    fechaEgreso: body.fechaEgreso,
    ultimoSalarioBasicoDiarioVES: sal,
    nivelSalario: body.nivelSalario,
    motivoRetiro: body.motivoRetiro,
    nombreEmpleado: body.nombreEmpleado,
  };

  let resultado;
  try {
    resultado = CalculadoraLiquidacionConstruccion.calcular(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error en cálculo';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!body.redactarFiniquito) {
    return NextResponse.json({ resultado, documentoFiniquito: null, finiquitoGeneradoConGemini: false });
  }

  let texto: string;
  let generadoConGemini: boolean;
  try {
    const out = await redactarDocumentoFiniquitoConGemini(resultado, body.nombreEmpleado, {
      requiereGemini: true,
    });
    texto = out.texto;
    generadoConGemini = out.generadoConGemini;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al redactar finiquito';
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  return NextResponse.json({
    resultado,
    documentoFiniquito: texto,
    finiquitoGeneradoConGemini: generadoConGemini,
  });
}
