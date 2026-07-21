-- Corrige devaluación CCO: brecha Binance/BCV (+) → forma V4 (−).
-- Ejemplo: +34,45 % → −25,62216 %  (= -brecha / (100 + brecha) * 100)
-- Ejecutar en SQL Editor de Supabase si el dashboard aún muestra +34,45.
-- Luego: notify pgrst, 'reload schema'; (opcional).

update public.cco_proyecto_config
set
  devaluacion_pct = round(((-devaluacion_pct) / (100 + devaluacion_pct) * 100)::numeric, 5),
  updated_at = now()
where devaluacion_pct > 0
  and devaluacion_pct < 200;

-- Verificación:
-- select proyecto_id, devaluacion_pct from public.cco_proyecto_config order by updated_at desc;
