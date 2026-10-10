/**
 * Bot de ensayo: conversa con el bot como lo haría una persona en Telegram.
 *
 * Cada paso arma el mismo mensaje que mandaría Telegram (texto, botón o foto), lo pasa
 * por el webhook real con Telegram en modo captura y anota qué respondió el bot.
 * Las personas son las de la obra de ensayo; ningún paso puede tocar una obra real.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { enSimulacionBot, type BotonSimulado, type EnvioSimulado } from '@/lib/telegram/simulacion/contexto';
import {
  PERSONAS_ENSAYO,
  referenciaReal,
  usuariosSistemaDeEnsayo,
  uuidsEn,
  type ClavePersonaEnsayo,
  type ObraDeEnsayoLista,
  type PersonaEnsayo,
} from '@/lib/telegram/simulacion/obraDeEnsayo';

/** Un paso del guion. Exactamente una acción: texto, botón, dato de botón o foto. */
export type PasoGuion = {
  /** Quién actúa. */
  q: ClavePersonaEnsayo;
  /** Escribe este texto. */
  t?: string;
  /** Pulsa el botón cuyo texto contiene esto (sin distinguir mayúsculas ni acentos). */
  b?: string;
  /** Pulsa un botón por su dato interno (callback_data). */
  d?: string;
  /** Envía una foto. */
  f?: boolean | 1;
  /** Texto que acompaña la foto. */
  c?: string;
};

export type RespuestaResumida = {
  para: string;
  tipo: 'mensaje' | 'alerta' | 'aviso' | 'edicion' | 'otro';
  texto: string;
  botones: Array<{ texto: string; data: string | null }>;
};

export type ResultadoPaso = {
  n: number;
  quien: string;
  accion: string;
  /** Qué rama del webhook atendió el paso (lo que respondería a Telegram). */
  ruta: unknown;
  respuestas: RespuestaResumida[];
  /** Sesión del bot para esa persona después del paso. */
  sesion: { contexto: string | null; flujo: string | null; paso: string | null } | null;
  error?: string;
};

/** Recibe un «update» de Telegram y devuelve la respuesta del webhook. */
export type DespachadorWebhook = (update: Record<string, unknown>) => Promise<unknown>;

const MAX_PAGINAS = 6;

export function sinFormato(texto: string | null): string {
  return String(texto ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function nombreDeChat(chatId: string | null): string {
  const persona = Object.values(PERSONAS_ENSAYO).find((p) => String(p.chatId) === chatId);
  return persona ? persona.nombre : `chat ${chatId ?? '—'}`;
}

export function resumirEnvio(e: EnvioSimulado): RespuestaResumida {
  const tipo: RespuestaResumida['tipo'] =
    e.metodo === 'answerCallbackQuery'
      ? e.alerta
        ? 'alerta'
        : 'aviso'
      : e.metodo.startsWith('send')
        ? 'mensaje'
        : e.metodo.startsWith('editMessage')
          ? 'edicion'
          : 'otro';
  return {
    para: nombreDeChat(e.chatId),
    tipo,
    texto: sinFormato(e.texto),
    botones: e.botones.map((b) => ({ texto: b.texto, data: b.data })),
  };
}

export class ErrorDeEnsayo extends Error {}

export class BotDeEnsayo {
  readonly pasos: ResultadoPaso[] = [];
  /** Todo lo que el bot ha enviado en esta corrida, en orden. */
  readonly envios: EnvioSimulado[] = [];
  private secuencia = 0;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly obra: ObraDeEnsayoLista,
    private readonly despachar: DespachadorWebhook,
  ) {}

  private persona(clave: ClavePersonaEnsayo): PersonaEnsayo {
    const p = PERSONAS_ENSAYO[clave];
    if (!p) throw new ErrorDeEnsayo(`No existe la persona de ensayo «${String(clave)}».`);
    return p;
  }

  /** Mensajes (no avisos emergentes) que el bot le ha enviado a esta persona. */
  mensajesPara(clave: ClavePersonaEnsayo): EnvioSimulado[] {
    const chat = String(this.persona(clave).chatId);
    return this.envios.filter((e) => e.chatId === chat && e.metodo !== 'answerCallbackQuery');
  }

  ultimoPara(clave: ClavePersonaEnsayo): EnvioSimulado | undefined {
    return this.mensajesPara(clave).at(-1);
  }

  /** Texto de todo lo que respondió el bot en el último paso (mensajes y alertas). */
  textoUltimoPaso(): string {
    return (this.pasos.at(-1)?.respuestas ?? []).map((r) => r.texto).join('\n');
  }

  /** Botones del último mensaje con botones enviado a esta persona. */
  botonesVigentes(clave: ClavePersonaEnsayo): BotonSimulado[] {
    const mensajes = this.mensajesPara(clave);
    for (let i = mensajes.length - 1; i >= 0; i -= 1) {
      const botones = mensajes[i]!.botones.filter((b) => b.data);
      if (botones.length) return botones;
    }
    return [];
  }

  /** Busca un botón por su texto entre los botones vigentes: exacto, luego por final, luego contenido. */
  private buscarBoton(clave: ClavePersonaEnsayo, etiqueta: string): BotonSimulado | null {
    const aguja = normalizar(etiqueta).trim();
    const mensajes = this.mensajesPara(clave);
    // Solo se pueden pulsar los botones del último mensaje que trae botones:
    // así un guion no «pulsa» por error un botón viejo de otro paso.
    for (let i = mensajes.length - 1; i >= 0; i -= 1) {
      const botones = mensajes[i]!.botones.filter((b) => b.data);
      if (!botones.length) continue;
      const limpio = (b: BotonSimulado) => normalizar(b.texto).trim();
      return (
        botones.find((b) => limpio(b) === aguja) ??
        botones.find((b) => limpio(b).endsWith(aguja)) ??
        botones.find((b) => limpio(b).includes(aguja)) ??
        null
      );
    }
    return null;
  }

  private async actualizar(
    persona: PersonaEnsayo,
    accion: string,
    update: Record<string, unknown>,
  ): Promise<ResultadoPaso> {
    const paso: ResultadoPaso = {
      n: this.pasos.length + 1,
      quien: persona.nombre,
      accion,
      ruta: null,
      respuestas: [],
      sesion: null,
    };
    this.pasos.push(paso);

    try {
      const { resultado, envios } = await enSimulacionBot(() => this.despachar(update), {
        usuariosSistema: usuariosSistemaDeEnsayo(),
      });
      paso.ruta = resultado;
      paso.respuestas = envios.map(resumirEnvio);
      this.envios.push(...envios);
    } catch (e) {
      paso.error = `El bot falló: ${e instanceof Error ? e.message : String(e)}`;
      throw new ErrorDeEnsayo(paso.error);
    }

    const { data: estado } = await this.supabase
      .from('ci_telegram_estados')
      .select('contexto,proyecto_id,metadata')
      .eq('chat_id', String(persona.chatId))
      .maybeSingle();
    const fila = estado as { contexto?: string | null; proyecto_id?: string | null; metadata?: unknown } | null;
    if (fila) {
      const meta = (fila.metadata ?? {}) as { flujo?: unknown; paso?: unknown };
      paso.sesion = {
        contexto: fila.contexto ?? null,
        flujo: typeof meta.flujo === 'string' ? meta.flujo : null,
        paso: typeof meta.paso === 'string' ? meta.paso : null,
      };
      // La sesión no puede quedar apuntando a una obra o un almacén real.
      const real = await referenciaReal(
        this.supabase,
        this.obra,
        uuidsEn(`${fila.proyecto_id ?? ''} ${JSON.stringify(fila.metadata ?? {})}`),
      );
      if (real) {
        await this.supabase
          .from('ci_telegram_estados')
          .update({ contexto: 'menu', proyecto_id: null, metadata: {} })
          .eq('chat_id', String(persona.chatId));
        paso.error = `Ensayo detenido: la sesión quedó apuntando a ${real}. Se cerró la sesión sin registrar nada.`;
        throw new ErrorDeEnsayo(paso.error);
      }
    }
    return paso;
  }

  private remitente(p: PersonaEnsayo) {
    return { id: p.chatId, is_bot: false, first_name: p.nombre, username: `ensayo_${p.clave}` };
  }

  async escribir(clave: ClavePersonaEnsayo, texto: string): Promise<ResultadoPaso> {
    const p = this.persona(clave);
    this.secuencia += 1;
    return this.actualizar(p, `escribe «${texto}»`, {
      update_id: 900_000_000 + this.secuencia,
      message: {
        message_id: 700_000 + this.secuencia,
        from: this.remitente(p),
        chat: { id: p.chatId, type: 'private', first_name: p.nombre },
        date: Math.floor(Date.now() / 1000),
        text: texto,
      },
    });
  }

  async foto(clave: ClavePersonaEnsayo, pie?: string): Promise<ResultadoPaso> {
    const p = this.persona(clave);
    this.secuencia += 1;
    return this.actualizar(p, pie ? `envía una foto con el texto «${pie}»` : 'envía una foto', {
      update_id: 900_000_000 + this.secuencia,
      message: {
        message_id: 700_000 + this.secuencia,
        from: this.remitente(p),
        chat: { id: p.chatId, type: 'private', first_name: p.nombre },
        date: Math.floor(Date.now() / 1000),
        photo: [
          { file_id: `ensayo-foto-${this.secuencia}-s`, width: 90, height: 90 },
          { file_id: `ensayo-foto-${this.secuencia}`, width: 1280, height: 960 },
        ],
        ...(pie ? { caption: pie } : {}),
      },
    });
  }

  /** Pulsa un botón por su dato interno. */
  async pulsarDato(clave: ClavePersonaEnsayo, data: string, etiqueta?: string): Promise<ResultadoPaso> {
    const p = this.persona(clave);
    const real = await referenciaReal(this.supabase, this.obra, uuidsEn(data));
    if (real) {
      const paso: ResultadoPaso = {
        n: this.pasos.length + 1,
        quien: p.nombre,
        accion: `pulsa «${etiqueta ?? data}»`,
        ruta: null,
        respuestas: [],
        sesion: null,
        error: `Ensayo detenido: ese botón apunta a ${real}. No se pulsó.`,
      };
      this.pasos.push(paso);
      throw new ErrorDeEnsayo(paso.error);
    }
    this.secuencia += 1;
    return this.actualizar(p, `pulsa «${etiqueta ?? data}»`, {
      update_id: 900_000_000 + this.secuencia,
      callback_query: {
        id: `ensayo-cb-${this.secuencia}`,
        data,
        from: this.remitente(p),
        message: { message_id: 600_000 + this.secuencia, chat: { id: p.chatId, type: 'private' } },
      },
    });
  }

  /**
   * Pulsa el botón cuyo texto contiene `etiqueta`. Si el último mensaje es una lista
   * paginada y el botón no está, avanza de página hasta encontrarlo.
   */
  async pulsar(clave: ClavePersonaEnsayo, etiqueta: string): Promise<ResultadoPaso> {
    for (let pagina = 0; pagina <= MAX_PAGINAS; pagina += 1) {
      const boton = this.buscarBoton(clave, etiqueta);
      if (boton?.data) return this.pulsarDato(clave, boton.data, boton.texto);

      const siguiente = this.botonesVigentes(clave).find(
        (b) => b.data && /^(siguiente\b.*|▶|»|>)$/i.test(b.texto.trim()),
      );
      if (!siguiente?.data) break;
      await this.pulsarDato(clave, siguiente.data, siguiente.texto);
    }

    const visibles = this.botonesVigentes(clave)
      .map((b) => `«${b.texto}»`)
      .join(', ');
    const paso: ResultadoPaso = {
      n: this.pasos.length + 1,
      quien: this.persona(clave).nombre,
      accion: `pulsa «${etiqueta}»`,
      ruta: null,
      respuestas: [],
      sesion: null,
      error: `No hay ningún botón con «${etiqueta}». En el último mensaje hay: ${visibles || 'ninguno'}.`,
    };
    this.pasos.push(paso);
    throw new ErrorDeEnsayo(paso.error);
  }

  /** Ejecuta un guion libre, paso a paso. */
  async ejecutarGuion(guion: PasoGuion[]): Promise<void> {
    for (const paso of guion) {
      if (paso.t != null) await this.escribir(paso.q, paso.t);
      else if (paso.b != null) await this.pulsar(paso.q, paso.b);
      else if (paso.d != null) await this.pulsarDato(paso.q, paso.d);
      else if (paso.f) await this.foto(paso.q, paso.c);
      else throw new ErrorDeEnsayo('Paso de guion sin acción: use t (texto), b (botón), d (dato) o f (foto).');
    }
  }
}

/** Valida un guion recibido como JSON. Devuelve el guion o el motivo del rechazo. */
export function leerGuion(crudo: unknown): { ok: true; guion: PasoGuion[] } | { ok: false; error: string } {
  if (!Array.isArray(crudo)) return { ok: false, error: 'El guion debe ser una lista de pasos.' };
  if (crudo.length > 40) return { ok: false, error: 'El guion admite hasta 40 pasos por corrida.' };
  const guion: PasoGuion[] = [];
  for (let i = 0; i < crudo.length; i += 1) {
    const paso = crudo[i] as Record<string, unknown> | null;
    if (!paso || typeof paso !== 'object') return { ok: false, error: `Paso ${i + 1}: no es un objeto.` };
    if (typeof paso.q !== 'string' || !(paso.q in PERSONAS_ENSAYO)) {
      return { ok: false, error: `Paso ${i + 1}: «q» debe ser ${Object.keys(PERSONAS_ENSAYO).join(', ')}.` };
    }
    const acciones = (['t', 'b', 'd'] as const).filter((k) => typeof paso[k] === 'string').length + (paso.f ? 1 : 0);
    if (acciones !== 1) return { ok: false, error: `Paso ${i + 1}: debe tener exactamente una acción (t, b, d o f).` };
    guion.push({
      q: paso.q as ClavePersonaEnsayo,
      ...(typeof paso.t === 'string' ? { t: paso.t } : {}),
      ...(typeof paso.b === 'string' ? { b: paso.b } : {}),
      ...(typeof paso.d === 'string' ? { d: paso.d } : {}),
      ...(paso.f ? { f: true } : {}),
      ...(typeof paso.c === 'string' ? { c: paso.c } : {}),
    });
  }
  return { ok: true, guion };
}
