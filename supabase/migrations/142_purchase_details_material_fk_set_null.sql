-- Permite borrar material en cuarentena al revertir una compra (contabilidad / recepción).
-- Sin ON DELETE SET NULL, DELETE en global_inventory falla si purchase_details aún referencia el id.

alter table public.purchase_details
  drop constraint if exists purchase_details_material_id_fkey;

alter table public.purchase_details
  add constraint purchase_details_material_id_fkey
  foreign key (material_id) references public.global_inventory(id) on delete set null;

alter table public.quality_inspections
  drop constraint if exists quality_inspections_material_id_fkey;

alter table public.quality_inspections
  add constraint quality_inspections_material_id_fkey
  foreign key (material_id) references public.global_inventory(id) on delete set null;

notify pgrst, 'reload schema';
