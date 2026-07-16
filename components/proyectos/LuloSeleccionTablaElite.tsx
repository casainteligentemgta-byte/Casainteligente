'use client';

import { useMemo, useState } from 'react';
import { Database, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export type LuloSeleccionTablaProps = {
  availableTables: string[];
  fileName?: string | null;
  hint?: string;
  importing?: boolean;
  onCancel: () => void;
  onConfirm: (tableName: string) => void;
};

function suggestInitialTable(tables: string[]): string {
  const preferred = tables.find((t) => /^(partidas|presupuesto)$/i.test(t.trim()));
  return preferred ?? tables[0] ?? '';
}

/** Estado intermedio Elite Black: lista de tablas del MDB (sin dropzone). */
export function LuloSeleccionTablaElite({
  availableTables,
  fileName,
  hint,
  importing = false,
  onCancel,
  onConfirm,
}: LuloSeleccionTablaProps) {
  const initial = useMemo(() => suggestInitialTable(availableTables), [availableTables]);
  const [selected, setSelected] = useState(initial);

  const canConfirm = selected.trim() !== '' && availableTables.includes(selected);

  return (
    <Card className="border-white/10 bg-[#0A0A0F] text-zinc-100 shadow-2xl backdrop-blur-xl w-full max-w-lg">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-500/30">
            <Table2 className="h-5 w-5 text-sky-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold text-zinc-100 tracking-tight">
              Tablas en el archivo MDB
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-1 leading-relaxed">
              No se detectó automáticamente una tabla <strong className="text-zinc-400">Partidas</strong>{' '}
              o <strong className="text-zinc-400">Presupuesto</strong>. Elige la que contiene el
              presupuesto de obra.
            </CardDescription>
          </div>
        </div>

        {fileName ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <Database className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="text-xs text-zinc-400 truncate">{fileName}</span>
          </div>
        ) : null}

        {hint ? (
          <p className="mt-2 text-[11px] text-sky-400/90 border border-sky-500/20 rounded-lg px-2 py-1.5 bg-sky-500/5">
            {hint}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="pt-4">
        {availableTables.length === 0 ? (
          <p className="text-xs text-red-400/90 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            El archivo no expuso tablas legibles. Prueba con otro MDB o usa Inspeccionar antes de
            importar.
          </p>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 max-h-64 overflow-y-auto">
            <RadioGroup
              value={selected}
              onValueChange={setSelected}
              disabled={importing}
              className="gap-1.5"
            >
              {availableTables.map((name) => (
                <RadioGroupItem key={name} value={name}>
                  <span className="font-mono text-[13px]">{name}</span>
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </div>
        )}
        <p className="mt-3 text-[10px] text-zinc-600 uppercase tracking-wide">
          {availableTables.length} tabla{availableTables.length === 1 ? '' : 's'} disponible
          {availableTables.length === 1 ? '' : 's'}
        </p>
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
          disabled={!canConfirm || importing}
          className="flex-1 h-10 text-xs font-semibold bg-[#34C759] hover:bg-[#2eb04f] text-black shadow-lg shadow-[#34C759]/20 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
          onClick={() => onConfirm(selected)}
        >
          {importing ? 'Importando…' : 'Continuar'}
        </Button>
      </CardFooter>
    </Card>
  );
}
