import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  columnExists,
  connectPostgresFromEnv,
} from '@/lib/supabase/connectPostgresFromEnv';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** POST — Repara columnas faltantes en contabilidad_compras (221, 229). Solo service role. */
export async function POST() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let sql: Awaited<ReturnType<typeof connectPostgresFromEnv>> | null = null;
  try {
    sql = await connectPostgresFromEnv();
    const migDir = path.join(process.cwd(), 'supabase/migrations');
    const applied: string[] = [];
    const skipped: string[] = [];

    if (!(await columnExists(sql, 'contabilidad_compras', 'alerta_fecha'))) {
      const text = fs.readFileSync(
        path.join(migDir, '221_compras_auditoria_fecha.sql'),
        'utf8',
      );
      await sql.unsafe(text);
      applied.push('221_compras_auditoria_fecha');
    } else {
      skipped.push('221');
    }

    if (!(await columnExists(sql, 'contabilidad_compras', 'updated_at'))) {
      const text = fs.readFileSync(
        path.join(migDir, '229_contabilidad_compras_updated_at.sql'),
        'utf8',
      );
      await sql.unsafe(text);
      applied.push('229_contabilidad_compras_updated_at');
    } else {
      skipped.push('229');
      await sql.unsafe(`notify pgrst, 'reload schema';`);
    }

    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'contabilidad_compras'
        and column_name in ('updated_at', 'alerta_fecha', 'fecha_confirmada_manual')
      order by column_name
    `;

    return NextResponse.json({
      ok: true,
      applied,
      skipped,
      columnas: cols.map((c) => c.column_name),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de reparación';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => {});
  }
}
