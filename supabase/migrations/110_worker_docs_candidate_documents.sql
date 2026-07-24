-- Bucket worker-docs + metadatos de documentos de candidatos (persons) para reclutamiento / RRHH.
-- Rutas sugeridas: candidates/{person_id}/{uuid}.{ext}

insert into storage.buckets (id, name, public)
values ('worker-docs', 'worker-docs', false)
on conflict (id) do nothing;

drop policy if exists "worker_docs_select_anon" on storage.objects;
drop policy if exists "worker_docs_insert_anon" on storage.objects;
drop policy if exists "worker_docs_update_anon" on storage.objects;
drop policy if exists "worker_docs_delete_anon" on storage.objects;
drop policy if exists "worker_docs_select_auth" on storage.objects;
drop policy if exists "worker_docs_insert_auth" on storage.objects;
drop policy if exists "worker_docs_update_auth" on storage.objects;
drop policy if exists "worker_docs_delete_auth" on storage.objects;

create policy "worker_docs_select_anon"
on storage.objects for select to anon
using (bucket_id = 'worker-docs');

create policy "worker_docs_insert_anon"
on storage.objects for insert to anon
with check (bucket_id = 'worker-docs');

create policy "worker_docs_update_anon"
on storage.objects for update to anon
using (bucket_id = 'worker-docs');

create policy "worker_docs_delete_anon"
on storage.objects for delete to anon
using (bucket_id = 'worker-docs');

create policy "worker_docs_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'worker-docs');

create policy "worker_docs_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'worker-docs');

create policy "worker_docs_update_auth"
on storage.objects for update to authenticated
using (bucket_id = 'worker-docs');

create policy "worker_docs_delete_auth"
on storage.objects for delete to authenticated
using (bucket_id = 'worker-docs');

-- ─── Metadatos (vinculan Storage ↔ persons) ─────────────────────────────
create table if not exists public.person_candidate_documents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  storage_bucket text not null default 'worker-docs',
  storage_path text not null,
  document_kind text not null
    check (document_kind in ('cedula', 'curso_seguridad', 'otro')),
  mime_type text,
  original_filename text,
  validated_at timestamptz,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_candidate_documents_curso_expiry check (
    document_kind <> 'curso_seguridad'
    or validated_at is null
    or expiry_date is not null
  )
);

create index if not exists idx_person_candidate_documents_person
  on public.person_candidate_documents (person_id);

create index if not exists idx_person_candidate_documents_kind
  on public.person_candidate_documents (person_id, document_kind);

comment on table public.person_candidate_documents is
  'Documentos de candidatos en bucket worker-docs; RRHH marca validated_at; curso_seguridad exige expiry_date al validar.';

alter table public.person_candidate_documents enable row level security;

drop policy if exists "pcd_select_anon" on public.person_candidate_documents;
drop policy if exists "pcd_insert_anon" on public.person_candidate_documents;
drop policy if exists "pcd_update_anon" on public.person_candidate_documents;
drop policy if exists "pcd_delete_anon" on public.person_candidate_documents;
drop policy if exists "pcd_select_auth" on public.person_candidate_documents;
drop policy if exists "pcd_insert_auth" on public.person_candidate_documents;
drop policy if exists "pcd_update_auth" on public.person_candidate_documents;
drop policy if exists "pcd_delete_auth" on public.person_candidate_documents;

create policy "pcd_select_anon" on public.person_candidate_documents for select to anon using (true);
create policy "pcd_insert_anon" on public.person_candidate_documents for insert to anon with check (true);
create policy "pcd_update_anon" on public.person_candidate_documents for update to anon using (true) with check (true);
create policy "pcd_delete_anon" on public.person_candidate_documents for delete to anon using (true);
create policy "pcd_select_auth" on public.person_candidate_documents for select to authenticated using (true);
create policy "pcd_insert_auth" on public.person_candidate_documents for insert to authenticated with check (true);
create policy "pcd_update_auth" on public.person_candidate_documents for update to authenticated using (true) with check (true);
create policy "pcd_delete_auth" on public.person_candidate_documents for delete to authenticated using (true);

grant select, insert, update, delete on public.person_candidate_documents to anon, authenticated, service_role;

notify pgrst, 'reload schema';
