-- Las entidades cliente_administrada no repiten el nombre: se lee de customers.nombre.
-- ci_entidades.nombre queda nullable, pero obligatorio cuando la entidad no está enlazada a un cliente.
alter table public.ci_entidades alter column nombre drop not null;

alter table public.ci_entidades
  drop constraint if exists ci_entidades_nombre_requerido_check;

alter table public.ci_entidades
  add constraint ci_entidades_nombre_requerido_check
  check (customer_id is not null or (nombre is not null and btrim(nombre) <> ''));

-- El prefijo SAP de una entidad enlazada a cliente sale del nombre del cliente.
create or replace function public.global_inventory_set_sap()
returns trigger
language plpgsql
as $function$
declare
  v_prefijo text;
  v_next bigint;
begin
  if new.sap_code is not null and trim(new.sap_code) <> '' then
    return new;
  end if;

  if new.entidad_id is not null then
    select c.sap_prefijo
      into v_prefijo
      from public.ci_catalogos_entidad c
     where c.entidad_id = new.entidad_id;

    if v_prefijo is null then
      select public.ci_catalogo_sap_prefijo_desde_nombre(coalesce(cu.nombre, e.nombre))
        into v_prefijo
        from public.ci_entidades e
        left join public.customers cu on cu.id = e.customer_id
       where e.id = new.entidad_id;
    end if;

    v_prefijo := coalesce(nullif(trim(v_prefijo), ''), 'ENT');

    insert into public.ci_catalogo_sap_secuencias (prefijo, ultimo_val)
    values (v_prefijo, 0)
    on conflict (prefijo) do nothing;

    update public.ci_catalogo_sap_secuencias
       set ultimo_val = ultimo_val + 1
     where prefijo = v_prefijo
     returning ultimo_val into v_next;

    new.sap_code := v_prefijo || '-' || lpad(v_next::text, 6, '0');
    return new;
  end if;

  new.sap_code := 'SAP-' || lpad(nextval('public.inventory_sap_seq')::text, 6, '0');
  return new;
end;
$function$;
