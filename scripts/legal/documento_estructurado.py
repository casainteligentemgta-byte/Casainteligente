"""Documento legal estructurado → markdown / HTML (misma forma que el JSON de bloques)."""

from __future__ import annotations

import json
from typing import Any, Dict, List


def estructurado_to_markdown(doc: Dict[str, Any]) -> str:
    lines: List[str] = [f"# {doc.get('document_title', 'Documento')}", ""]
    for block in doc.get("blocks") or []:
        t = block.get("type")
        content = block.get("content")
        if t == "title":
            lines += [f"## {content}", ""]
        elif t == "subtitle":
            lines += [f"### {content}", ""]
        elif t == "paragraph":
            lines += [str(content), ""]
        elif t == "clause":
            lines += [f"> {content}", ""]
        elif t == "list" and isinstance(content, list):
            lines += [f"- {i}" for i in content] + [""]
        elif t == "table" and isinstance(content, list) and content:
            keys = list(content[0].keys())
            lines.append("| " + " | ".join(keys) + " |")
            lines.append("| " + " | ".join("---" for _ in keys) + " |")
            for row in content:
                lines.append("| " + " | ".join(str(row.get(k, "")) for k in keys) + " |")
            lines.append("")
        elif t == "signature":
            lines += ["", "______________________________", str(content), ""]
    return "\n".join(lines).strip() + "\n"


if __name__ == "__main__":
    example = {
        "document_title": "Contrato de Prestación de Servicios",
        "blocks": [
            {"type": "title", "content": "CLÁUSULA PRIMERA: OBJETO DEL CONTRATO"},
            {"type": "paragraph", "content": "LA EMPRESA XX se compromete a realizar..."},
            {"type": "clause", "content": "El pago será de Bs. XXX pagadero mensualmente..."},
            {
                "type": "table",
                "content": [
                    {"col1": "Concepto", "col2": "Monto"},
                    {"col1": "Servicio A", "col2": "100"},
                ],
            },
        ],
    }
    print(estructurado_to_markdown(example))
    print(json.dumps(example, ensure_ascii=False, indent=2))
