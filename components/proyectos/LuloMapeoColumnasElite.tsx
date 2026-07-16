'use client';

import { useMemo, useState } from 'react';
import { Columns3, Database } from 'lucide-react';
import {
  defaultMapping,
  type LuloCustomPartidaMapping,
} from '@/lib/proyectos/luloStandardColumns';
import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type LuloMapeoColumnasProps = {
  detectedColumns: string[];
  suggestedTable: string | null;
  hint?: string;
  fileName?: string | null;
  importing?: boolean;
  onCancel: () => void;
  onConfirm: (mapping: LuloCustomPartidaMapping) => void;
};

type FieldKey = keyof typeof defaultMapping;

const FIELD_DEFS: {
  key: FieldKey;
  label: string;
  luloDefault: string;
}[] = [
  { key: 'codigo', label: 'Código', luloDefault: defaultMapping.codigo },
  { key: 'descripcion', label: 'Descripción', luloDefault: defaultMapping.descripcion },
  { key: 'unidad', label: 'Unidad', luloDefault: defaultMapping.unidad },
  { key: 'cantidad', label: 'Cantidad', luloDefault: defaultMapping.cantidad },
  { key: 'precio', label: 'P. unitario', luloDefault: defaultMapping.precio },
  { key: 'monto', label: 'Monto', luloDefault: defaultMapping.monto },
];

const REQUIRED_FIELD_KEYS: FieldKey[] = [
  'codigo',
  'descripcion',
  'unidad',
  'cantidad',
  'precio',
];

const EMPTY = '__none__';

function guessColumn(columns: string[], patterns: RegExp[]): string {
  for (const col of columns) {
    const n = normalizeColumnKey(col);
    if (patterns.some((p) => p.test(n))) return col;
  }
  return '';
}

function buildInitialMapping(columns: string[]): Record<FieldKey, string> {
  return {
    codigo:
      guessColumn(columns, [/^codpar$/, /^cod_par$/, /codigo/, /^cod$/, /partida/, /rubro/]) ||
      '',
    descripcion:
      guessColumn(columns, [/^despar$/, /^des_par$/, /descrip/, /concepto/, /detalle/]) || '',
    unidad:
      guessColumn(columns, [/^unipar$/, /^uni_par$/, /unidad/, /^und$/]) || '',
    cantidad:
      guessColumn(columns, [/^canpar$/, /^can_par$/, /cantidad/, /^cant$/]) || '',
    precio:
      guessColumn(columns, [/^prepar$/, /^pre_par$/, /precio/, /unitario/, /^pu$/]) || '',
    monto:
      guessColumn(columns, [/^monpar$/, /^mon_par$/, /^totpar$/, /monto/, /importe/, /parcial/]) ||
      '',
  };
}

/**
 * Estado intermedio Elite Black: empareja columnas del MDB con el presupuesto.
 * Se muestra cuando la API responde `requireMapping: true`.
 */
export function LuloMapeoColumnasElite({
  detectedColumns,
  suggestedTable,
  hint,
  fileName,
  importing = false,
  onCancel,
  onConfirm,
}: LuloMapeoColumnasProps) {
  const initial = useMemo(() => buildInitialMapping(detectedColumns), [detectedColumns]);
  const [values, setValues] = useState<Record<FieldKey, string>>(initial);

  const setField = (key: FieldKey, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v === EMPTY ? '' : v }));
  };

  const canConfirm = REQUIRED_FIELD_KEYS.every((key) => values[key]?.trim() !== '');

  const usedColumns = new Set(
    FIELD_DEFS.map(({ key }) => values[key]).filter((v) => v && v !== EMPTY),
  );
  const hasDuplicates = usedColumns.size < FIELD_DEFS.filter(({ key }) => values[key]).length;

  return (
    <Card className="border-white/10 bg-[#0A0A0F] text-zinc-100 shadow-2xl backdrop-blur-xl max-w-lg w-full">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF9500]/15 border border-[#FF9500]/30">
            <Columns3 className="h-5 w-5 text-[#FF9500]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold text-zinc-100 tracking-tight">
              Mapeo de columnas del presupuesto
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Opcional: el MDB no usa CodPar/DesPar; puedes emparejar columnas o cancelar y dejar que la importación automática infiera los datos.
              Asocia cada campo obligatorio con una columna detectada en el MDB.
            </CardDescription>
          </div>
        </div>
        {fileName ? (
          <p className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
            <Database className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span className="truncate">{fileName}</span>
            {suggestedTable ? (
              <span className="text-zinc-600">
                · tabla <span className="text-zinc-400">{suggestedTable}</span>
              </span>
            ) : null}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-2 text-[11px] text-amber-400/90 border border-amber-500/20 rounded-lg px-2 py-1.5 bg-amber-500/5">
            {hint}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {detectedColumns.length === 0 ? (
          <p className="text-xs text-red-400/90 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            No se detectaron columnas en el primer registro. Usa «Inspeccionar MDB» o revisa el
            archivo.
          </p>
        ) : (
          <div className="grid gap-4">
            {FIELD_DEFS.map(({ key, label, luloDefault }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-zinc-500 font-medium">
                  {label}
                  <span className="text-zinc-600 normal-case tracking-normal">
                    {' '}
                    · Lulo: <span className="text-[#FFD60A]/80">{luloDefault}</span>
                  </span>
                </Label>
                <Select
                  value={values[key] || EMPTY}
                  onValueChange={(v) => setField(key, v)}
                  disabled={importing}
                >
                  <SelectTrigger aria-label={`Columna para ${label}`}>
                    <SelectValue placeholder={`Elegir columna — ${label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY}>— Sin asignar —</SelectItem>
                    {detectedColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {hasDuplicates ? (
          <p className="text-[11px] text-amber-400/90">
            Cada campo debe usar una columna distinta del archivo.
          </p>
        ) : null}

        <details className="group rounded-lg border border-white/10 bg-white/[0.02]">
          <summary className="cursor-pointer list-none px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-400">
            Columnas detectadas ({detectedColumns.length})
          </summary>
          <p className="px-3 pb-2 text-[10px] leading-relaxed text-zinc-600 break-all">
            {detectedColumns.join(' · ') || '—'}
          </p>
        </details>
      </CardContent>

      <CardFooter className="flex gap-2 border-t border-white/10 pt-4">
        <Button
          type="button"
          variant="elite"
          className="flex-1 h-10 text-xs"
          onClick={onCancel}
          disabled={importing}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!canConfirm || hasDuplicates || importing || detectedColumns.length === 0}
          className="flex-1 h-10 text-xs font-semibold bg-[#34C759] hover:bg-[#2eb04f] text-black shadow-lg shadow-[#34C759]/20 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
          onClick={() =>
            onConfirm({
              tableName: suggestedTable ?? undefined,
              codigo: values.codigo,
              descripcion: values.descripcion,
              unidad: values.unidad,
              cantidad: values.cantidad,
              precio: values.precio,
              ...(values.monto?.trim() ? { monto: values.monto } : {}),
            })
          }
        >
          {importing ? 'Importando…' : 'Importar con este mapeo'}
        </Button>
      </CardFooter>
    </Card>
  );
}

/** @deprecated Usar `LuloMapeoColumnasElite`. */
export { LuloMapeoColumnasElite as LuloColumnMappingPanel };
