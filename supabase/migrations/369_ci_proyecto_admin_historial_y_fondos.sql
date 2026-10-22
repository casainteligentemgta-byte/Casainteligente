-- Historial del porcentaje de administración (con vigencia).
CREATE TABLE public.ci_proyecto_admin_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.ci_proyectos(id) ON DELETE CASCADE,
  porcentaje numeric NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  vigente_desde date NOT NULL,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ci_proyecto_admin_historial_proy_idx
  ON public.ci_proyecto_admin_historial (proyecto_id, vigente_desde DESC);

-- Fondos que el propietario envía para la obra administrada (nombre distinto a ci_proyecto_fondos, que ya existe).
CREATE TABLE public.ci_obra_fondos_propietario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.ci_proyectos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0),
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','VES')),
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ci_obra_fondos_propietario_proy_idx
  ON public.ci_obra_fondos_propietario (proyecto_id, fecha);

-- Carga inicial: el % actual de cada obra queda vigente desde su inicio (o hoy si no tiene fecha).
INSERT INTO public.ci_proyecto_admin_historial (proyecto_id, porcentaje, vigente_desde, creado_por)
SELECT p.id, p.porcentaje_admin, COALESCE(p.fecha_inicio, CURRENT_DATE), 'migracion_369'
FROM public.ci_proyectos p
WHERE p.porcentaje_admin IS NOT NULL;

ALTER TABLE public.ci_proyecto_admin_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_obra_fondos_propietario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated all admin_historial" ON public.ci_proyecto_admin_historial
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all fondos_propietario" ON public.ci_obra_fondos_propietario
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
