import type { SupabaseClient } from '@supabase/supabase-js';
import { getGeminiApiKey } from '@/lib/gemini/client';
import {
  extraerDatosRegistroAguaGemini,
  ppmDesdeExtraccionPrueba,
} from '@/lib/telegram/extractAguaGemini';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export const REGISTRO_AGUA_BUCKET = 'ci-proyectos-media';
const MAX_BYTES = 12 * 1024 * 1024;

export type CrearRegistroAguaWebInput = {
  proyectoId: string;
  fotoTanque: File;
  fotoPrueba: File;
  /** ISO timestamptz; si falta, usa ahora. */
  registradoEn?: string | null;
  placaVehiculo?: string | null;
  litrosEntregados?: number | null;
  ppmMinerales?: number | null;
  creadoPor: string;
  /** Si true y hay Gemini, intenta leer placa/PPM de las fotos. */
  usarIa?: boolean;
};

export type RegistroAguaCreado = {
  id: string;
  proyecto_id: string;
  foto_tanque_url: string;
  foto_prueba_url: string;
  creado_por: string;
  chat_id: string | null;
  created_at: string;
  registrado_en: string;
  placa_vehiculo: string | null;
  medicion_agua: number | null;
  unidad_medicion: string | null;
  detalle_medicion: string | null;
  litros_entregados: number | null;
  ppm_minerales: number | null;
  extraccion_ia: Record<string, unknown>;
};

function assertImagen(file: File, etiqueta: string): void {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error(`Falta la foto de ${etiqueta}.`);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`La foto de ${etiqueta} debe ser una imagen.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`La foto de ${etiqueta} supera 12 MB.`);
  }
}

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic';
  return 'jpg';
}

async function subirFotoAgua(
  supabase: SupabaseClient,
  proyectoId: string,
  etiqueta: 'tanque' | 'prueba',
  file: File,
): Promise<string> {
  const ext = extFromFile(file);
  const path = `web/agua/${proyectoId}/${Date.now()}-${etiqueta}.${ext}`;
  const { error } = await supabase.storage.from(REGISTRO_AGUA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw new Error(`Storage (${etiqueta}): ${error.message}`);
  const { data } = supabase.storage.from(REGISTRO_AGUA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function parseRegistradoEn(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return new Date().toISOString();
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Fecha del registro inválida.');
  }
  return d.toISOString();
}

/**
 * Crea un registro de agua desde la web (fotos históricas + fecha editable).
 */
export async function crearRegistroAguaWeb(
  supabase: SupabaseClient,
  input: CrearRegistroAguaWebInput,
): Promise<RegistroAguaCreado> {
  const proyectoId = input.proyectoId.trim();
  if (!proyectoId) throw new Error('proyecto_id obligatorio.');

  assertImagen(input.fotoTanque, 'tanque/camión');
  assertImagen(input.fotoPrueba, 'prueba PPM');

  const registradoEn = parseRegistradoEn(input.registradoEn);
  let placa = input.placaVehiculo?.trim() || null;
  let litros =
    input.litrosEntregados != null && Number.isFinite(input.litrosEntregados)
      ? Number(input.litrosEntregados)
      : null;
  let ppm =
    input.ppmMinerales != null && Number.isFinite(input.ppmMinerales)
      ? Number(input.ppmMinerales)
      : null;
  let detallePpm: string | null = null;
  let extraccionIa: Record<string, unknown> = {
    origen: 'web',
    ia_disponible: Boolean(getGeminiApiKey()),
  };

  const [fotoTanqueUrl, fotoPruebaUrl] = await Promise.all([
    subirFotoAgua(supabase, proyectoId, 'tanque', input.fotoTanque),
    subirFotoAgua(supabase, proyectoId, 'prueba', input.fotoPrueba),
  ]);

  const usarIa = input.usarIa !== false && Boolean(getGeminiApiKey());
  if (usarIa && (!placa || ppm == null)) {
    try {
      const bufTanque = Buffer.from(await input.fotoTanque.arrayBuffer());
      const bufPrueba = Buffer.from(await input.fotoPrueba.arrayBuffer());
      const extraccion = await extraerDatosRegistroAguaGemini({
        bufferTanque: bufTanque,
        mimeTanque: input.fotoTanque.type || 'image/jpeg',
        bufferPrueba: bufPrueba,
        mimePrueba: input.fotoPrueba.type || 'image/jpeg',
      });
      extraccionIa = {
        origen: 'web',
        ia_disponible: true,
        placa: extraccion.placa,
        medicion: extraccion.medicion,
      };
      if (!placa) placa = extraccion.placa.placa_vehiculo?.trim() || null;
      if (ppm == null) ppm = ppmDesdeExtraccionPrueba(extraccion.medicion);
      detallePpm = extraccion.medicion.detalle_medicion?.trim() || null;
    } catch (err) {
      extraccionIa = {
        origen: 'web',
        ia_disponible: true,
        ia_error: formatErrorMessage(err).slice(0, 200),
      };
    }
  }

  const { data, error } = await supabase
    .from('registro_agua_obrero')
    .insert({
      proyecto_id: proyectoId,
      foto_tanque_url: fotoTanqueUrl,
      foto_prueba_url: fotoPruebaUrl,
      creado_por: input.creadoPor.trim() || 'web',
      chat_id: null,
      registrado_en: registradoEn,
      placa_vehiculo: placa,
      litros_entregados: litros,
      ppm_minerales: ppm,
      medicion_agua: ppm,
      unidad_medicion: ppm != null ? 'ppm' : null,
      detalle_medicion: detallePpm,
      extraccion_ia: extraccionIa,
    })
    .select(
      'id, proyecto_id, foto_tanque_url, foto_prueba_url, creado_por, chat_id, created_at, registrado_en, placa_vehiculo, medicion_agua, unidad_medicion, detalle_medicion, litros_entregados, ppm_minerales, extraccion_ia',
    )
    .single();

  if (error) throw new Error(formatErrorMessage(error));
  return data as RegistroAguaCreado;
}

export async function actualizarFechaRegistroAgua(
  supabase: SupabaseClient,
  proyectoId: string,
  registroId: string,
  registradoEn: string,
): Promise<RegistroAguaCreado> {
  const iso = parseRegistradoEn(registradoEn);
  const { data, error } = await supabase
    .from('registro_agua_obrero')
    .update({ registrado_en: iso })
    .eq('id', registroId.trim())
    .eq('proyecto_id', proyectoId.trim())
    .select(
      'id, proyecto_id, foto_tanque_url, foto_prueba_url, creado_por, chat_id, created_at, registrado_en, placa_vehiculo, medicion_agua, unidad_medicion, detalle_medicion, litros_entregados, ppm_minerales, extraccion_ia',
    )
    .single();
  if (error) throw new Error(formatErrorMessage(error));
  return data as RegistroAguaCreado;
}
