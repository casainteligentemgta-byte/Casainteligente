import { createClient } from '@/lib/supabase/server';
import { formatMdbReadError, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { bulkInsertCiPresupuestoPartidas } from '@/lib/proyectos/guardarPartidasPresupuestoBulk';
import {
  buildResumenSnapshotExtraccion,
  extraccionDesdePayload,
  extraerMdbLuloCompleto,
  guardarSnapshotLulo,
  postExtraerLuloCompleto,
  type LuloExtraccionCompleta,
} from '@/lib/proyectos/extraerMdbLuloCompleto';
import { parsePresupuestoLuloCsvComplete } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import {
  importFromLuloMdbFullDump,
  partidasDesdeVolcadoMinimo,
  parsePresupuestoLuloMdb,
} from '@/lib/proyectos/parsePresupuestoLuloMdb';
import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import type { LuloCustomPartidaMapping } from '@/lib/proyectos/luloStandardColumns';
import type { GastoObraLuloInsert } from '@/types/lulo-import';
import { NextResponse } from 'next/server';

const GASTOS_BATCH_SIZE = 200;

function isMdbFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.mdb') || name.endsWith('.accdb');
}

async function insertGastosBatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gastos: GastoObraLuloInsert[],
  proyectoId: string,
) {
  const pid = proyectoId.trim();
  const rows = gastos.map((g) => ({
    ...g,
    proyecto_id: g.proyecto_id?.trim() ? g.proyecto_id : pid,
  }));

  for (let i = 0; i < rows.length; i += GASTOS_BATCH_SIZE) {
    const batch = rows.slice(i, i + GASTOS_BATCH_SIZE);
    const { error } = await supabase.from('gastos_obra').insert(batch);
    if (error) throw error;
  }
}

/**
 * Importa presupuesto Lulo (MDB/CSV) y persiste partidas en `ci_presupuesto_partidas`.
 * `proyectoId` debe venir del segmento de URL de la API.
 */
export async function postImportarLuloPresupuesto(
  req: Request,
  proyectoId: string,
  formDataIn?: FormData,
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const pid = proyectoId.trim();

    if (!pid) {
      return NextResponse.json({ error: 'proyectoId requerido en la URL' }, { status: 400 });
    }

    const formData = formDataIn ?? (await req.formData());
    const formProyectoId = String(formData.get('proyectoId') ?? '').trim();
    if (formProyectoId && formProyectoId !== pid) {
      return NextResponse.json(
        { error: 'El proyectoId del formulario no coincide con el de la URL.' },
        { status: 400 },
      );
    }

    const file = formData.get('file');
    const reemplazar = formData.get('reemplazar') === 'true' || formData.get('reemplazar') === '1';
    const importarGastos =
      formData.get('importarGastos') !== 'false' && formData.get('importarGastos') !== '0';
    const tableName =
      String(formData.get('tableName') ?? formData.get('selectedTable') ?? '').trim() || undefined;
    const customMappingRaw =
      formData.get('customMapping') ?? formData.get('columnMapping');
    let customMapping: LuloCustomPartidaMapping | undefined;
    if (typeof customMappingRaw === 'string' && customMappingRaw.trim()) {
      try {
        customMapping = JSON.parse(customMappingRaw) as LuloCustomPartidaMapping;
      } catch {
        return NextResponse.json(
          {
            error: 'customMapping no es JSON válido.',
            hint: 'Envía un objeto con codigo, descripcion, unidad, cantidad, precio (nombres de columna del MDB).',
          },
          { status: 400 },
        );
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
    }

    const soloExtraer =
      formData.get('soloExtraer') === 'true' || formData.get('soloExtraer') === '1';

    if (soloExtraer) {
      const { extraccion, resumen, snapshotId } = await postExtraerLuloCompleto(
        supabase,
        pid,
        file,
        reemplazar,
      );
      const tablasConDatos = extraccion.catalogoTablas.filter((t) => t.rowCount > 0).length;
      return NextResponse.json({
        success: true,
        extraccionCompleta: true,
        message: `Extracción completa: ${extraccion.catalogoTablas.length} tablas, ${extraccion.filasTotales} filas.`,
        proyectoId: pid,
        snapshotId,
        resumen,
        catalogoTablas: extraccion.catalogoTablas,
        tablasConDatos,
        filasTotales: extraccion.filasTotales,
      });
    }

    const formato = isMdbFile(file) ? 'mdb' : 'csv';
    let partidasRaw: import('@/lib/proyectos/parsePresupuestoLuloCsv').PartidaLuloInsert[] = [];
    let gastosInsert: GastoObraLuloInsert[] = [];
    let payload: Record<string, unknown> = {};
    let meta: Record<string, unknown> = { formato };
    let extraccionVolcado: LuloExtraccionCompleta | null = null;

    if (formato === 'mdb') {
      const buffer = toMdbNodeBuffer(await file.arrayBuffer());
      extraccionVolcado = extraerMdbLuloCompleto(buffer);
      const dump = extraccionVolcado.payload as LuloMdbFullDump;
      payload = dump as unknown as Record<string, unknown>;

      const fb = importFromLuloMdbFullDump(dump, pid, importarGastos);
      partidasRaw = fb.partidas;
      gastosInsert = fb.gastos;

      if (partidasRaw.length === 0 && gastosInsert.length === 0) {
        partidasRaw = partidasDesdeVolcadoMinimo(dump, pid);
      }

      if (partidasRaw.length === 0 && gastosInsert.length === 0) {
        const parsed = parsePresupuestoLuloMdb(buffer, pid, {
          importarGastos,
          customMapping,
          selectedTable: tableName,
        });

        if (parsed.success) {
          partidasRaw = parsed.partidas ?? [];
          gastosInsert = parsed.gastos ?? [];
          if (partidasRaw.length > 0 || gastosInsert.length > 0) {
            meta = { ...meta, ...parsed.meta, modoImportacion: 'parser_estructurado' };
          }
        } else if (
          partidasRaw.length === 0 &&
          gastosInsert.length === 0 &&
          'requireTableSelection' in parsed &&
          parsed.requireTableSelection
        ) {
          const snap = await guardarSnapshotLulo(supabase, {
            proyectoId: pid,
            nombreArchivo: file.name,
            extraccion: extraccionVolcado,
            resumen: buildResumenSnapshotExtraccion(extraccionVolcado),
            reemplazarSnapshots: false,
          });
          return NextResponse.json(
            {
              success: false,
              requireTableSelection: true,
              availableTables: parsed.availableTables,
              meta: parsed.meta,
              snapshotId: snap?.id ?? null,
              catalogoTablas: extraccionVolcado.catalogoTablas,
              hint:
                'Elige la tabla del presupuesto. El volcado completo del MDB ya está en Datos Lulo.',
            },
            { status: 422 },
          );
        }
      }

      meta = {
        ...meta,
        formato: 'mdb',
        filasTotales: extraccionVolcado.filasTotales,
        tablasPartidas: fb.tablasPartidas,
        tablasGastos: fb.tablasGastos,
        catalogoTablas: extraccionVolcado.catalogoTablas,
        diagnosticoResumen: `MDB: ${extraccionVolcado.catalogoTablas.length} tablas, ${extraccionVolcado.filasTotales} filas.`,
        modoImportacion:
          (meta.modoImportacion as string | undefined) ??
          (partidasRaw.length > 0 ? 'volcado_completo' : undefined),
      };
    } else {
      const text = await file.text();
      const parsed = parsePresupuestoLuloCsvComplete(text, pid, importarGastos);
      partidasRaw = parsed.partidas;
      gastosInsert = parsed.gastos;
      payload = parsed.fullDump as unknown as Record<string, unknown>;
      meta = { ...meta, ...parsed.meta };
    }

    if (partidasRaw.length === 0 && gastosInsert.length === 0) {
      let snapshotIdVolcado: string | null = null;
      const extraccion =
        extraccionVolcado ?? extraccionDesdePayload(payload, formato);
      if (extraccion) {
        const snap = await guardarSnapshotLulo(supabase, {
          proyectoId: pid,
          nombreArchivo: file.name,
          extraccion,
          resumen: buildResumenSnapshotExtraccion(extraccion),
          reemplazarSnapshots: reemplazar,
        });
        snapshotIdVolcado = snap?.id ?? null;
      }

      const diag =
        typeof meta.diagnosticoResumen === 'string' ? meta.diagnosticoResumen : '';
      const base =
        formato === 'mdb'
          ? 'No se encontraron partidas ni gastos válidos en el MDB.'
          : 'No se encontraron partidas ni gastos válidos en el CSV.';
      const filasVolcado = extraccion?.filasTotales ?? 0;
      const inspeccion =
        formato === 'mdb'
          ? filasVolcado > 0
            ? ` Se guardaron ${filasVolcado} filas en Datos Lulo. Abre Presupuesto · Lulo → Control de obra para ver tablas; si hace falta, usa «Extraer todo el MDB» y revisa columnas.`
            : ' Revisa que el archivo sea de Lulo/Access o que no esté protegido con contraseña.'
          : '';
      return NextResponse.json(
        {
          error: diag ? `${base}${inspeccion} ${diag}` : `${base}${inspeccion}`,
          meta,
          snapshotId: snapshotIdVolcado,
          catalogoTablas: extraccion?.catalogoTablas,
          extraccionCompleta: Boolean(snapshotIdVolcado),
          filasTotales: filasVolcado,
        },
        { status: 400 },
      );
    }

    if (reemplazar) {
      if (importarGastos) {
        const { error: delGastos } = await supabase
          .from('gastos_obra')
          .delete()
          .eq('proyecto_id', pid)
          .in('origen', ['lulo_mdb', 'lulo_csv']);
        if (delGastos && !delGastos.message.includes('proyecto_id')) throw delGastos;
      }
    }

    let partidasGuardadas = 0;
    if (partidasRaw.length > 0) {
      const { insertadas } = await bulkInsertCiPresupuestoPartidas(supabase, pid, partidasRaw, {
        reemplazar,
      });
      partidasGuardadas = insertadas;
    }

    if (gastosInsert.length > 0) {
      await insertGastosBatches(supabase, gastosInsert, pid);
    }

    const presupuestoTotal =
      typeof meta.presupuestoTotalUsd === 'number'
        ? meta.presupuestoTotalUsd
        : partidasRaw.reduce((s, p) => s + p.monto_total_estimado, 0);

    const extraccion: LuloExtraccionCompleta =
      extraccionDesdePayload(payload, formato) ?? {
        formato,
        payload: payload as LuloExtraccionCompleta['payload'],
        catalogoTablas: [],
        filasTotales: partidasGuardadas + gastosInsert.length,
        creationDate: null,
      };

    const resumen = buildResumenSnapshotExtraccion(extraccion, {
      partidas: partidasGuardadas,
      gastos: gastosInsert.length,
      presupuestoTotalUsd: presupuestoTotal as number,
    });

    const snap = await guardarSnapshotLulo(supabase, {
      proyectoId: pid,
      nombreArchivo: file.name,
      extraccion,
      resumen,
      reemplazarSnapshots: reemplazar,
    });

    const parts: string[] = [];
    if (partidasGuardadas > 0) parts.push(`${partidasGuardadas} partidas`);
    if (gastosInsert.length > 0) parts.push(`${gastosInsert.length} gastos`);

    return NextResponse.json({
      success: true,
      message: `Importación Lulo: ${parts.join(' y ')}.`,
      proyectoId: pid,
      partidas: partidasGuardadas,
      gastos: gastosInsert.length,
      presupuestoTotalUsd: presupuestoTotal,
      snapshotId: snap?.id ?? null,
      reemplazar,
      meta,
      resumen,
      catalogoTablas: extraccion.catalogoTablas,
      filasTotales: extraccion.filasTotales,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Error al importar el presupuesto.';
    const friendly = formatMdbReadError(err);
    if (friendly !== raw) {
      return NextResponse.json({ error: friendly }, { status: 400 });
    }
    console.error('[postImportarLuloPresupuesto]', err);
    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
