#!/usr/bin/env python3
"""
API FastAPI de referencia — Agente Pheme (procesar audio).

Equivalente Next.js: POST /api/pheme/procesar-audio

Uso:
  pip install fastapi uvicorn python-multipart google-genai psycopg2-binary
  export GEMINI_API_KEY=... DATABASE_URL=...
  uvicorn scripts.api_pheme_fastapi:app --reload --port 8000

Form fields: titulo_reunion, duracion_minutos?, archivo_audio
"""

from __future__ import annotations

import json
import os
import tempfile
import time

import psycopg2
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from google import genai
from google.genai import types

app = FastAPI(title="API Agente Pheme - Procesamiento de Reuniones")

client = genai.Client()


def obtener_conexion_pg():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "tu_base_datos"),
        user=os.getenv("DB_USER", "tu_usuario"),
        password=os.getenv("DB_PASSWORD", "tu_contrasena"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


@app.post("/api/pheme/procesar-audio")
async def procesar_audio_reunion(
    titulo_reunion: str = Form(...),
    duracion_minutos: int = Form(None),
    archivo_audio: UploadFile = File(...),
):
    """
    Endpoint que recibe un archivo de audio, lo transcribe con diarización,
    genera la minuta estructurada con Pheme y guarda el registro en PostgreSQL.
    """
    tmp_path = None
    try:
        suffix = os.path.splitext(archivo_audio.filename or ".mp3")[1] or ".mp3"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            content = await archivo_audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # 1. Subir audio a la API de Gemini para Transcripción
        audio_uploaded = client.files.upload(file=tmp_path)

        while getattr(audio_uploaded.state, "name", str(audio_uploaded.state)) == "PROCESSING":
            time.sleep(2)
            audio_uploaded = client.files.get(name=audio_uploaded.name)

        prompt_transcripcion = """
        Escucha atentamente este audio de reunión y genera una transcripción literal completa.
        Es fundamental que identifiques y etiquetes a cada hablante según su voz o cuando digan su nombre.
        
        Formato requerido:
        Hablante 1 (o Nombre): [Texto dicho]
        Hablante 2 (o Nombre): [Texto dicho]
        """

        response_trans = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[audio_uploaded, prompt_transcripcion],
        )
        transcripcion_raw = response_trans.text.strip()
        client.files.delete(name=audio_uploaded.name)

        # 2. Procesar transcripción con Pheme para generar Minuta JSON
        system_prompt_pheme = """
        Eres Pheme, un agente inteligente especializado en analizar transcripciones de reuniones.
        Tu objetivo es extraer los puntos clave, acuerdos, compromisos asignados y devolver la información en formato JSON estricto.

        Responde ÚNICAMENTE con un objeto JSON con esta estructura exacta:
        {
          "resumen_ejecutivo": "Síntesis breve de 2-3 oraciones sobre la reunión.",
          "puntos_clave": ["Punto 1", "Punto 2"],
          "acuerdos": [
            {"tarea": "Descripción de la tarea", "responsable": "Nombre del participante", "fecha_limite": "YYYY-MM-DD o N/A"}
          ],
          "pendientes_o_alertas": ["Pendiente 1"]
        }
        """

        prompt_analisis = (
            f"Analiza la siguiente transcripción de la reunión '{titulo_reunion}':\n\n"
            f"{transcripcion_raw}"
        )

        response_pheme = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_analisis,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt_pheme,
                response_mime_type="application/json",
            ),
        )

        minuta_json = json.loads(response_pheme.text)

        # 3. Insertar datos en PostgreSQL
        conn = obtener_conexion_pg()
        cursor = conn.cursor()

        insert_query = """
            INSERT INTO reuniones_pheme 
            (titulo_reunion, duracion_minutos, transcripcion_raw, resumen_ejecutivo, minuta_json)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            RETURNING id_reunion;
        """

        cursor.execute(
            insert_query,
            (
                titulo_reunion,
                duracion_minutos,
                transcripcion_raw,
                minuta_json.get("resumen_ejecutivo"),
                json.dumps(minuta_json, ensure_ascii=False),
            ),
        )

        id_reunion = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()

        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

        return {
            "status": "success",
            "id_reunion": id_reunion,
            "minuta": minuta_json,
            "transcripcion": transcripcion_raw,
        }

    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=str(e)) from e
