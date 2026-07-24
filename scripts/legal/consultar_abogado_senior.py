#!/usr/bin/env python3
"""
Consulta RAG legal: search → ensamblar prompt → gpt-4o.

  python scripts/legal/consultar_abogado_senior.py \\
    --query "¿Cómo se calcula la prestación de antigüedad?" \\
    --categoria laboral
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openai import OpenAI

from abogado_senior_prompt import ask_abogado_senior
from search_legal_knowledge import search_legal_knowledge


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", "-q", required=True)
    ap.add_argument("--categoria", default=None)
    ap.add_argument("--threshold", type=float, default=0.65)
    ap.add_argument("--count", type=int, default=6)
    ap.add_argument("--model", default=os.environ.get("LEGAL_CHAT_MODEL", "gpt-4o"))
    args = ap.parse_args()

    hits = search_legal_knowledge(
        args.query,
        category_filter=args.categoria,
        match_threshold=args.threshold,
        match_count=args.count,
    )
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "").strip() or None)
    answer = ask_abogado_senior(client, hits, args.query, model=args.model)
    print(answer)
    print(f"\n---\nFuentes: {len(hits)} | modelo: {args.model}", file=sys.stderr)
    print(
        json.dumps(
            [
                {
                    "referencia": h.get("referencia"),
                    "similarity": h.get("similarity"),
                }
                for h in hits
            ],
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
