/**
 * Generador de texto legal estilo bufete tecnológico (referencia CENTAURO LAW — placeholders).
 * No constituye asesoría legal; revisión por abogado local obligatoria antes de firma.
 */

export type DatosContrato = {
  empleadoNombre: string;
  empleadoDocumento?: string | null;
  obraNombre: string;
  obraUbicacion?: string | null;
  clienteObra?: string | null;
  montoAcordadoUsd: number;
  porcentajeInicial: number;
  fechaEmision: string;
};

export function generarTextoLegalCentauro(d: DatosContrato): string {
  const inicialUsd = (d.montoAcordadoUsd * d.porcentajeInicial) / 100;
  const restoUsd = d.montoAcordadoUsd - inicialUsd;

  return `
CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES / TÉCNICOS
(Modelo operativo CASA INTELIGENTE — revisión legal CENTAURO LAW)

Fecha de emisión: ${d.fechaEmision}

ENTRE:
Por una parte, CASA INTELIGENTE, en adelante "LA EMPRESA", y por la otra, ${d.empleadoNombre}, identificado documentalmente ${d.empleadoDocumento ?? 'según constancias aportadas'}, en adelante "EL PRESTADOR".

OBJETO
EL PRESTADOR ejecutará los trabajos vinculados a la obra "${d.obraNombre}"${d.obraUbicacion ? `, ubicada en ${d.obraUbicacion}` : ''}${d.clienteObra ? `, para el cliente/proyecto: ${d.clienteObra}` : ''}, conforme a instrucciones del responsable de obra y estándares de calidad y seguridad de LA EMPRESA.

CONTRAPRESTACIÓN
El monto total acordado es de USD ${d.montoAcordadoUsd.toFixed(2)}.
Se establece un pago inicial del ${d.porcentajeInicial.toFixed(2)}% (USD ${inicialUsd.toFixed(2)}), y el saldo de USD ${restoUsd.toFixed(2)} sujeto a hitos de avance y conformidad técnica, salvo acuerdo escrito distinto.

CONFIDENCIALIDAD Y PROPIEDAD INTELECTUAL
Todo entregable, código, esquemas, listados de materiales y metodologías desarrollados en el marco del encargo son de titularidad de LA EMPRESA, salvo pacto expreso en contrario.

SEGURIDAD Y CUMPLIMIENTO
EL PRESTADOR se compromete a cumplir normativa eléctrica aplicable, uso de EPP cuando corresponda, y protocolos de acceso a instalaciones del cliente.

RESOLUCIÓN DE CONTROVERSIAS
Las partes se someten a mediación de buena fe y, en su defecto, a los tribunales competentes según domicilio de LA EMPRESA, sin perjuicio de lo que disponga la ley laboral/sustantiva local.

DECLARACIONES
Las partes declaran haber leído y comprendido este documento. Firman en duplicado.

__________________________              __________________________
Por LA EMPRESA                            EL PRESTADOR

— Fin del borrador —
`.trim();
}
