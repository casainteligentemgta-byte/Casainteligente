import { NextResponse } from 'next/server';
import { loadSession, normalizeSessionId, saveSession } from '@/lib/recruitment/session-store';
import type { RecruitmentCvDraft } from '@/types/recruitment';

/** Guarda borrador de hoja de vida en el estado de la sesión de reclutamiento (?need=). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      needId?: string;
      nombreCompleto?: string;
      cedula?: string;
      telefono?: string;
      talla_camisa?: string;
      talla_botas?: string;
      cedula_foto_url?: string | null;
    };
    const sessionId = normalizeSessionId(body.sessionId);
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
    }

    const nombreCompleto = (body.nombreCompleto ?? '').trim();
    const cedula = (body.cedula ?? '').trim();
    const telefono = (body.telefono ?? '').trim() || undefined;
    const talla_camisa = (body.talla_camisa ?? '').trim() || 'M';
    const talla_botas = String(body.talla_botas ?? '40').trim() || '40';
    const fotoInBody =
      body.cedula_foto_url != null && String(body.cedula_foto_url).trim() !== ''
        ? String(body.cedula_foto_url).trim()
        : undefined;

    if (nombreCompleto.length < 2) {
      return NextResponse.json({ error: 'Indica nombre y apellido (mín. 2 caracteres).' }, { status: 400 });
    }
    if (cedula.length < 4) {
      return NextResponse.json({ error: 'Indica un documento de identidad válido.' }, { status: 400 });
    }

    const state = await loadSession(sessionId);
    if (!state) {
      return NextResponse.json({ error: 'sesión no encontrada' }, { status: 401 });
    }
    /** La entrevista guiada puede cerrar la sesión; el obrero debe poder seguir enviando/actualizando la hoja de vida. */
    if (state.expiresAt <= Date.now()) {
      return NextResponse.json(
        { error: 'sesión expirada', hint: 'Abre de nuevo el enlace que te envió RRHH para obtener una sesión nueva.' },
        { status: 410 },
      );
    }

    const bodyNeed = (body.needId ?? '').trim();
    if (bodyNeed && state.needId && bodyNeed !== state.needId) {
      return NextResponse.json(
        { error: 'need_mismatch', hint: 'El ID de vacante no coincide con esta sesión.' },
        { status: 403 },
      );
    }

    const draft: RecruitmentCvDraft = {
      nombreCompleto,
      cedula,
      telefono,
      talla_camisa,
      talla_botas,
      cedula_foto_url: fotoInBody ?? state.cvDraft?.cedula_foto_url ?? null,
      savedAt: Date.now(),
    };
    state.cvDraft = draft;
    await saveSession(state);
    return NextResponse.json({ ok: true, savedAt: draft.savedAt });
  } catch (e) {
    console.error('[recruitment/session-cv]', e);
    return NextResponse.json(
      { error: 'session_cv_failed', hint: e instanceof Error ? e.message : 'Error' },
      { status: 500 },
    );
  }
}
