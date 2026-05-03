import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { HojaDeVidaPdfDoc } from '@/lib/talento/hojaVidaPdfDoc';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?token= — PDF de hoja de vida a partir de `ci_empleados.token_registro`.
 * Requiere service role (no exponer datos sin token válido).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get('token') ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: emp, error } = await admin.client
    .from('ci_empleados')
    .select(
      'nombre_completo,cedula,documento,telefono,rol_buscado,talla_camisa,talla_botas,cedula_foto_url,estado_proceso',
    )
    .eq('token_registro', token)
    .maybeSingle();

  if (error) {
    console.error('[hoja-vida pdf]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!emp) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  const row = emp as {
    nombre_completo: string;
    cedula: string | null;
    documento: string | null;
    telefono: string | null;
    rol_buscado: string | null;
    talla_camisa: string | null;
    talla_botas: string | null;
    cedula_foto_url: string | null;
    estado_proceso: string | null;
  };

  const doc = String(row.cedula || row.documento || '').trim() || '—';
  const emitidoEn = new Date().toLocaleString('es-VE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  /** `pdf()` tipa el nodo como `<Document>`; nuestro componente ya renderiza `<Document>` raíz. */
  const pdfNode = createElement(HojaDeVidaPdfDoc, {
    data: {
      nombre: row.nombre_completo,
      documento: doc,
      telefono: (row.telefono ?? '').trim() || '—',
      rolBuscado: (row.rol_buscado ?? '').trim() || '—',
      tallaCamisa: (row.talla_camisa ?? '').trim() || '—',
      tallaBotas: (row.talla_botas ?? '').trim() || '—',
      estadoProceso: (row.estado_proceso ?? '').trim() || '—',
      fotoCedulaUrl: (row.cedula_foto_url ?? '').trim(),
      emitidoEn,
    },
  });
  const blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();

  const safeName = row.nombre_completo.replace(/[^\w\s-]/g, '').slice(0, 40) || 'candidato';

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="hoja-vida-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
