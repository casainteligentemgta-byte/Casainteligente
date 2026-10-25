-- Entidad propietaria de una ubicación de inventario (almacén sin obra).
-- Permite ver existencias por entidad cuando el almacén no pertenece a una obra.

ALTER TABLE public.inv_ubicaciones
  ADD COLUMN IF NOT EXISTS entidad_id uuid REFERENCES public.ci_entidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inv_ubicaciones_entidad_id_idx
  ON public.inv_ubicaciones (entidad_id)
  WHERE entidad_id IS NOT NULL;
