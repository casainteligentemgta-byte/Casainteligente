'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  UNIDADES_MEDIDA_DEFAULT,
  UNIDAD_CUSTOM_VALUE,
  codigoUnidadEnCatalogo,
  fusionarUnidadesMedida,
  normalizarCodigoUnidad,
  type UnidadMedidaOpcion,
} from '@/lib/almacen/unidadesMedidaDefault';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Si la página ya cargó inventory_units, pásalas aquí para evitar otro fetch. */
  units?: UnidadMedidaOpcion[];
  compact?: boolean;
  showLabel?: boolean;
  label?: string;
};

const selectClsDefault =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm font-bold outline-none transition-all focus:bg-white focus:text-black';
const inputClsDefault =
  'w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm font-bold outline-none transition-all focus:bg-white focus:text-black uppercase';

export default function SelectorUnidadMedida({
  value,
  onChange,
  disabled = false,
  className = selectClsDefault,
  inputClassName = inputClsDefault,
  units: unitsProp,
  compact = false,
  showLabel = false,
  label = 'Unidad',
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [unitsDb, setUnitsDb] = useState<UnidadMedidaOpcion[]>([]);

  const cargarUnidades = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_units')
      .select('code,name')
      .eq('active', true)
      .order('sort_order')
      .order('code');
    if (error || !data?.length) return;
    setUnitsDb(
      data.map((u) => ({
        code: normalizarCodigoUnidad(String(u.code)),
        name: String(u.name ?? u.code).trim() || normalizarCodigoUnidad(String(u.code)),
      })),
    );
  }, [supabase]);

  useEffect(() => {
    if (unitsProp?.length) return;
    void cargarUnidades();
  }, [cargarUnidades, unitsProp]);

  const catalogo = useMemo(
    () => fusionarUnidadesMedida(UNIDADES_MEDIDA_DEFAULT, unitsProp, unitsDb),
    [unitsProp, unitsDb],
  );

  const valorNormalizado = normalizarCodigoUnidad(value);
  const enCatalogo = codigoUnidadEnCatalogo(valorNormalizado, catalogo);
  const [modoPersonalizado, setModoPersonalizado] = useState(!enCatalogo);

  useEffect(() => {
    setModoPersonalizado(!codigoUnidadEnCatalogo(normalizarCodigoUnidad(value), catalogo));
  }, [value, catalogo]);

  const selectValue = modoPersonalizado ? UNIDAD_CUSTOM_VALUE : valorNormalizado;

  const handleSelect = (next: string) => {
    if (next === UNIDAD_CUSTOM_VALUE) {
      setModoPersonalizado(true);
      return;
    }
    setModoPersonalizado(false);
    onChange(normalizarCodigoUnidad(next));
  };

  const handleCustomInput = (raw: string) => {
    onChange(normalizarCodigoUnidad(raw));
  };

  const inputValue = modoPersonalizado && enCatalogo ? '' : valorNormalizado;

  const selectEl = (
    <select
      value={selectValue}
      onChange={(e) => handleSelect(e.target.value)}
      disabled={disabled}
      className={compact ? `${className} min-w-[4.5rem]` : className}
      aria-label={showLabel ? undefined : label}
    >
      {catalogo.map((u) => (
        <option key={u.code} value={u.code} className="text-black">
          {compact ? u.code : `${u.code} — ${u.name}`}
        </option>
      ))}
      <option value={UNIDAD_CUSTOM_VALUE} className="text-black">
        Otra…
      </option>
    </select>
  );

  const customEl =
    selectValue === UNIDAD_CUSTOM_VALUE ? (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleCustomInput(e.target.value)}
        disabled={disabled}
        placeholder="Ej. SAC, BOL…"
        maxLength={32}
        className={compact ? `${inputClassName} mt-1 min-w-[4.5rem]` : inputClassName}
        aria-label="Unidad personalizada"
      />
    ) : null;

  if (showLabel) {
    return (
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
          {label}
        </label>
        {selectEl}
        {customEl}
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {selectEl}
      {customEl}
    </div>
  );
}
