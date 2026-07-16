#!/usr/bin/env python3
"""
IurisVigía — análisis técnico-legal de fotos de inspección (LOPCYMAT).

  export OPENAI_API_KEY=...
  python scripts/legal/analyze_inspection_photo.py \\
    --image-url "https://.../foto.jpg" \\
    --context "Inspección de seguridad en Local Jorge Coll"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict

from openai import OpenAI

SYSTEM_PROMPT = """
Eres IurisVigía, un auditor técnico-legal experto en normativa venezolana (LOPCYMAT y estándares técnicos).
Tu tarea es analizar la imagen proporcionada dentro del contexto de: {context}.

Evalúa la imagen y devuelve estrictamente un JSON con este formato:
{{
    "descripcion": "Descripción técnica detallada de lo observado en la imagen.",
    "nota_legal": "Referencia técnica o legal sobre si esto cumple o no (ej: Art. 62 LOPCYMAT).",
    "estado_cumplimiento": "Conforme / No Conforme / Observación",
    "riesgo_identificado": "Descripción breve del riesgo técnico o legal."
}}
Si la imagen no es clara o no se puede analizar, indica 'No analizable' en los campos.
"""


def analyze_inspection_photo(
    image_url: str,
    context: str,
    *,
    openai_api_key: str | None = None,
    model: str = "gpt-4o",
) -> Dict[str, Any]:
    """
    Analiza una imagen mediante IA para generar una descripción técnica legal.
    'context' es el proyecto (ej: 'Inspección de seguridad en Local Jorge Coll').
    """
    key = (openai_api_key or os.environ.get("OPENAI_API_KEY", "")).strip()
    if not key:
        raise SystemExit("Falta OPENAI_API_KEY")
    if not (image_url or "").strip():
        raise ValueError("image_url vacío")

    client = OpenAI(api_key=key)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT.format(context=context),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analiza esta fotografía para mi reporte legal."},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def main() -> int:
    ap = argparse.ArgumentParser(description="IurisVigía — foto de inspección")
    ap.add_argument("--image-url", required=True, help="URL de la foto (Supabase Storage, etc.)")
    ap.add_argument(
        "--context",
        required=True,
        help="Contexto del proyecto / inspección",
    )
    ap.add_argument("--model", default=os.environ.get("LEGAL_VISION_MODEL", "gpt-4o"))
    args = ap.parse_args()

    report = analyze_inspection_photo(args.image_url, args.context, model=args.model)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
