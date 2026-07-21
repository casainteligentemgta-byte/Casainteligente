'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Dictado por voz (Web Speech API) → texto en español (Venezuela).
 */
export function useSpeechDictation(opts?: {
  lang?: string;
  onFinal?: (transcript: string) => void;
}) {
  const lang = opts?.lang ?? 'es-VE';
  const onFinalRef = useRef(opts?.onFinal);
  onFinalRef.current = opts?.onFinal;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    const r = recogRef.current;
    if (r) {
      try {
        r.onend = null;
        r.stop();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    }
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('El micrófono por voz no está disponible en este navegador.');
      return;
    }
    setError(null);
    stop();

    const recog = new Ctor();
    recog.lang = lang;
    recog.continuous = true;
    recog.interimResults = true;

    recog.onresult = (ev) => {
      let interimText = '';
      let finalChunk = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (!row) continue;
        const t = row[0]?.transcript ?? '';
        if (row.isFinal) finalChunk += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalChunk.trim()) {
        onFinalRef.current?.(finalChunk.trim());
      }
    };

    recog.onerror = (ev) => {
      const code = ev.error || 'error';
      if (code === 'aborted' || code === 'no-speech') return;
      setError(
        code === 'not-allowed'
          ? 'Permiso de micrófono denegado.'
          : `Error de dictado: ${code}`,
      );
      setListening(false);
    };

    recog.onend = () => {
      setListening(false);
      setInterim('');
      recogRef.current = null;
    };

    recogRef.current = recog;
    try {
      recog.start();
      setListening(true);
    } catch {
      setError('No se pudo iniciar el micrófono.');
      setListening(false);
    }
  }, [lang, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
