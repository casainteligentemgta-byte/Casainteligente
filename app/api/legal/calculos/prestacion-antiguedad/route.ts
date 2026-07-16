import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { calcularGarantiaTrimestral } from '@/lib/legal/calcularPrestacionAntiguedad';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/calculos/prestacion-antiguedad
 * Body: { salario_mensual, dias_utilidades?, dias_bono_vacacional? }
 */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const salario = Number(body.salario_mensual ?? body.salario ?? body.salarioMensual);
  if (!Number.isFinite(salario) || salario < 0) {
    return NextResponse.json({ error: 'salario_mensual inválido' }, { status: 400 });
  }

  try {
    const result = calcularGarantiaTrimestral(salario, {
      diasUtilidades:
        body.dias_utilidades != null ? Number(body.dias_utilidades) : undefined,
      diasBonoVacacional:
        body.dias_bono_vacacional != null
          ? Number(body.dias_bono_vacacional)
          : undefined,
      diasBaseAnual:
        body.dias_base_anual != null ? Number(body.dias_base_anual) : undefined,
      diasGarantiaTrimestral:
        body.dias_garantia != null ? Number(body.dias_garantia) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
