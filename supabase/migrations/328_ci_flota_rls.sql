-- Flota: las seis tablas quedaban abiertas a cualquiera con la clave pública
-- (sin RLS y con permisos para «anon»). Ahora solo entra quien inició sesión;
-- la app ya exige sesión en todas sus rutas /api/flota.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ci_flota_vehiculos',
    'ci_flota_conductores',
    'ci_flota_gasolina',
    'ci_flota_mantenimiento',
    'ci_flota_alertas',
    'ci_flota_alertas_config'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_autenticados', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_autenticados',
      t
    );
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
