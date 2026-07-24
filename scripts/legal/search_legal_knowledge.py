#!/usr/bin/env python3
"""
Búsqueda semántica en ci_legal_knowledge vía RPC match_legal_knowledge.

Uso CLI:
  export OPENAI_API_KEY=...
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...

  python scripts/legal/search_legal_knowledge.py \\
    --query "¿Cómo se calcula la prestación de antigüedad?" \\
    --categoria laboral

Uso como librería:
  from search_legal_knowledge import search_legal_knowledge
  hits = search_legal_knowledge("prestación de antigüedad", category_filter="laboral")
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional

try:
    from openai import OpenAI
except ImportError as e:
    raise SystemExit("Instale openai: pip install openai") from e

try:
    from supabase import create_client
except ImportError as e:
    raise SystemExit("Instale supabase: pip install supabase") from e

EMBEDDING_MODEL = "text-embedding-3-small"
RPC_NAME = "match_legal_knowledge"


def _clients(
    openai_api_key: Optional[str] = None,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
):
    key = (openai_api_key or os.environ.get("OPENAI_API_KEY", "")).strip()
    url = (
        supabase_url
        or os.environ.get("SUPABASE_URL", "")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    ).strip()
    sb_key = (supabase_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()
    if not key:
        raise SystemExit("Falta OPENAI_API_KEY")
    if not url or not sb_key:
        raise SystemExit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")
    return OpenAI(api_key=key), create_client(url, sb_key)


def search_legal_knowledge(
    query_text: str,
    category_filter: Optional[str] = None,
    *,
    match_threshold: float = 0.7,
    match_count: int = 5,
    filter_metadata: Optional[Dict[str, Any]] = None,
    model: str = EMBEDDING_MODEL,
    openai_api_key: Optional[str] = None,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    1) Embedding de la consulta
    2) RPC match_legal_knowledge con umbral y filtro de metadata
    """
    q = (query_text or "").strip()
    if not q:
        raise ValueError("query_text vacío")

    openai_client, supabase = _clients(openai_api_key, supabase_url, supabase_key)

    query_embedding = openai_client.embeddings.create(
        input=q,
        model=model,
    ).data[0].embedding

    filt: Optional[Dict[str, Any]] = None
    if filter_metadata:
        filt = dict(filter_metadata)
    if category_filter:
        filt = {**(filt or {}), "categoria": category_filter}

    response = supabase.rpc(
        RPC_NAME,
        {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "filter_metadata": filt,
        },
    ).execute()

    return list(response.data or [])


def main() -> int:
    ap = argparse.ArgumentParser(description="Búsqueda semántica legal (RAG)")
    ap.add_argument("--query", "-q", required=True, help="Consulta en lenguaje natural")
    ap.add_argument("--categoria", default=None, help="Filtro categoria (ej. laboral)")
    ap.add_argument("--tipo", default=None)
    ap.add_argument("--jurisdiccion", default=None)
    ap.add_argument("--referencia", default=None)
    ap.add_argument("--threshold", type=float, default=0.7)
    ap.add_argument("--count", type=int, default=5)
    ap.add_argument(
        "--filter-json",
        default=None,
        help='JSON filter_metadata, ej. {"categoria":"laboral"}',
    )
    args = ap.parse_args()

    filt: Dict[str, Any] = {}
    if args.filter_json:
        try:
            parsed = json.loads(args.filter_json)
            if not isinstance(parsed, dict):
                raise ValueError("debe ser objeto")
            filt.update(parsed)
        except Exception as e:
            raise SystemExit(f"--filter-json inválido: {e}") from e
    for key, val in (
        ("categoria", args.categoria),
        ("tipo", args.tipo),
        ("jurisdiccion", args.jurisdiccion),
        ("referencia", args.referencia),
    ):
        if val:
            filt[key] = val

    hits = search_legal_knowledge(
        args.query,
        category_filter=None,
        match_threshold=args.threshold,
        match_count=args.count,
        filter_metadata=filt or None,
    )

    print(json.dumps(hits, ensure_ascii=False, indent=2, default=str))
    print(f"\n{len(hits)} resultado(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
