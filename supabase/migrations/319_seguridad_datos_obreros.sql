-- 319 · Seguridad de datos personales de obreros y candidatos
--
-- Antes: el rol anónimo (la clave pública que va en el navegador) podía LEER, MODIFICAR y BORRAR
-- todas las filas de ci_empleados, persons, person_candidate_documents y ci_hojas_vida, y listar,
-- reemplazar o borrar archivos de cédulas, firmas y contratos en Storage.
--
-- Después:
--   · El personal con sesión iniciada (rol authenticated) conserva el acceso que ya tenía.
--   · Las rutas de servidor usan service_role y no se ven afectadas.
--   · Un visitante anónimo solo puede:
--       - crear su postulación (INSERT en ci_empleados / ci_hojas_vida),
--       - leer y actualizar SU PROPIA fila de ci_empleados enviando la cabecera x-invite-token
--         (token_registro o token legado) — ver lib/supabase/clientInvitacion.ts,
--       - subir archivos nuevos (INSERT) a talento-public y ci-proyectos-media.
--   · Nadie anónimo puede listar, reemplazar ni borrar archivos.

begin;

-- ── ci_empleados ────────────────────────────────────────────────────────────
drop policy if exists ci_empleados_public_read   on public.ci_empleados;
drop policy if exists ci_empleados_select_anon   on public.ci_empleados;
drop policy if exists ci_empleados_public_update on public.ci_empleados;
drop policy if exists ci_empleados_update_anon   on public.ci_empleados;
drop policy if exists ci_empleados_delete_anon   on public.ci_empleados;

drop policy if exists ci_empleados_public_read_by_token   on public.ci_empleados;
drop policy if exists ci_empleados_public_update_by_token on public.ci_empleados;

create or replace function public.ci_invite_token_header() returns text
language sql stable as $$
  select nullif(coalesce((current_setting('request.headers', true))::jsonb ->> 'x-invite-token', ''), '')
$$;

create policy ci_empleados_public_read_by_token on public.ci_empleados
  for select to anon
  using (
    public.ci_invite_token_header() is not null
    and (token_registro = public.ci_invite_token_header() or token = public.ci_invite_token_header())
  );

create policy ci_empleados_public_update_by_token on public.ci_empleados
  for update to anon
  using (
    public.ci_invite_token_header() is not null
    and (token_registro = public.ci_invite_token_header() or token = public.ci_invite_token_header())
  )
  with check (
    public.ci_invite_token_header() is not null
    and (token_registro = public.ci_invite_token_header() or token = public.ci_invite_token_header())
  );

-- ── ci_hojas_vida: el candidato inserta; no puede leer las de otros ─────────
drop policy if exists ci_hojas_vida_public_select on public.ci_hojas_vida;

-- ── persons / person_candidate_documents: solo personal con sesión ─────────
drop policy if exists persons_select_anon on public.persons;
drop policy if exists persons_insert_anon on public.persons;
drop policy if exists persons_update_anon on public.persons;
drop policy if exists persons_delete_anon on public.persons;
drop policy if exists pcd_select_anon on public.person_candidate_documents;
drop policy if exists pcd_insert_anon on public.person_candidate_documents;
drop policy if exists pcd_update_anon on public.person_candidate_documents;
drop policy if exists pcd_delete_anon on public.person_candidate_documents;

-- ── Storage ────────────────────────────────────────────────────────────────
-- worker-docs (privado): solo personal con sesión.
drop policy if exists worker_docs_select_anon on storage.objects;
drop policy if exists worker_docs_insert_anon on storage.objects;
drop policy if exists worker_docs_update_anon on storage.objects;
drop policy if exists worker_docs_delete_anon on storage.objects;

-- contratos_obreros (privado): lo escribe el servidor; el personal lee con sesión.
drop policy if exists contratos_obreros_select_anon on storage.objects;
drop policy if exists contratos_obreros_insert_anon on storage.objects;

-- talento-firmas (lo escribe el servidor): sin listado anónimo.
drop policy if exists talento_firmas_select_anon on storage.objects;

-- talento-public: el postulante sube fotos (INSERT); no puede listar, reemplazar ni borrar.
drop policy if exists talento_public_select_anon on storage.objects;
drop policy if exists talento_public_update_anon on storage.objects;
drop policy if exists talento_public_delete_anon on storage.objects;

-- ci-proyectos-media: igual que arriba; el listado queda solo para personal.
drop policy if exists "ci-proyectos-media select public" on storage.objects;
drop policy if exists "ci-proyectos-media update anon"   on storage.objects;
drop policy if exists "ci-proyectos-media delete anon"   on storage.objects;
create policy "ci-proyectos-media select authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'ci-proyectos-media');

commit;
