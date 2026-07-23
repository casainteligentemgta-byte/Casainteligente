-- Insertar plantilla global de Carta de Renuncia Laboral

insert into public.ci_legal_plantillas (
  org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables
)
select v.org_id, v.codigo, v.titulo, v.tipo, v.jurisdiccion, v.categoria, v.descripcion, v.cuerpo_markdown, v.variables
from (
  values
  (
    null::uuid,
    'carta_renuncia_laboral',
    'Carta de Renuncia Voluntaria',
    'carta',
    'venezuela',
    'laboral',
    'Formato estándar para renuncia voluntaria de un trabajador.',
    E'**{{ciudad_emision}}**, {{fecha_emision}}\n\n**Señores:**\n**{{entidad_nombre}}**\nPresente.-\n\n**Ref.: Carta de Renuncia Voluntaria**\n\nQuien suscribe, **{{nombre_trabajador}}**, titular de la cédula de identidad N° **{{cedula_trabajador}}**, por medio de la presente me dirijo a ustedes para notificarles formalmente mi decisión de renunciar de manera voluntaria al cargo de **{{cargo_trabajador}}** que he venido desempeñando en esta empresa desde el **{{fecha_ingreso}}**.\n\nMi último día de labores será el **{{fecha_ultimo_dia}}**.\n\nAgradezco de antemano todas las oportunidades de crecimiento personal y profesional que se me brindaron durante el tiempo que laboré en la empresa.\n\nSin más a que hacer referencia y esperando su mayor comprensión, se despide de ustedes,\n\nAtentamente,\n\n\n__________________________________\n**{{nombre_trabajador}}**\nC.I.: {{cedula_trabajador}}\n',
    '[
      {"key":"ciudad_emision","label":"Ciudad de Emisión"},
      {"key":"fecha_emision","label":"Fecha de la Carta"},
      {"key":"entidad_nombre","label":"Empresa (Patrono)"},
      {"key":"nombre_trabajador","label":"Nombre del Trabajador"},
      {"key":"cedula_trabajador","label":"Cédula del Trabajador"},
      {"key":"cargo_trabajador","label":"Cargo que Desempeña"},
      {"key":"fecha_ingreso","label":"Fecha de Inicio de Labores"},
      {"key":"fecha_ultimo_dia","label":"Último Día Laboral"}
    ]'::jsonb
  )
) as v(org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables)
where not exists (
  select 1 from public.ci_legal_plantillas p where p.codigo = v.codigo
);

notify pgrst, 'reload schema';
