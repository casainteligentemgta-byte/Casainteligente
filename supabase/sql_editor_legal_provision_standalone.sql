-- Provisionar un despacho externo (producto Legal standalone).
-- 1) Crea/invita el usuario en Supabase Auth.
-- 2) Sustituye email/nombre/plan y ejecuta.
-- 3) El usuario entra a https://casainteligente.company/legal
--    (sin CRM: plan trial|solo|equipo|estudio).

-- Ejemplo:
--   nombre: 'Estudio Pérez & Asociados'
--   email:  'abogado@ejemplo.com'
--   plan:   'solo'

do $$
declare
  v_email text := 'abogado@ejemplo.com';
  v_nombre text := 'Despacho externo (ejemplo)';
  v_plan text := 'trial'; -- trial | solo | equipo | estudio
  v_user_id uuid;
  v_org_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No existe auth.users con email %. Invítalo primero en Auth.', v_email;
  end if;

  insert into public.ci_legal_orgs (nombre, plan, status)
  values (v_nombre, v_plan, 'active')
  returning id into v_org_id;

  insert into public.ci_legal_entitlements (org_id, user_id, email, rol_legal, activo)
  values (v_org_id, v_user_id, lower(v_email), 'admin', true)
  on conflict (org_id, user_id) do update
    set activo = true,
        email = excluded.email,
        updated_at = now();

  raise notice 'OK org=% user=% plan=% → /legal standalone', v_org_id, v_user_id, v_plan;
end $$;
