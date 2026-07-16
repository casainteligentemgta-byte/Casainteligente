#!/usr/bin/env python3
"""
Salario integral diario y garantía trimestral — Art. 142 LOTTT (literal a).

Mínimos de ley por defecto: 30 días utilidades, 15 días bono vacacional.

  python scripts/legal/calcular_prestacion_antiguedad.py --salario 10000
"""

from __future__ import annotations

import argparse
import json
from typing import Any, Dict


def calcular_salario_integral_diario(
    salario_mensual: float,
    *,
    dias_utilidades: int = 30,
    dias_bono_vacacional: int = 15,
    dias_base_anual: int = 360,
) -> Dict[str, Any]:
    # Asumiendo mínimos de ley (30 días utilidades, 15 días bono vacacional)
    salario_diario = salario_mensual / 30
    alicuota_utilidades = salario_diario * (dias_utilidades / dias_base_anual)
    alicuota_bono = salario_diario * (dias_bono_vacacional / dias_base_anual)
    salario_integral_diario = salario_diario + alicuota_utilidades + alicuota_bono
    return {
        "salario_mensual": round(salario_mensual, 2),
        "salario_diario_base": round(salario_diario, 2),
        "alicuota_utilidades": round(alicuota_utilidades, 2),
        "alicuota_bono_vacacional": round(alicuota_bono, 2),
        "salario_integral_diario": round(salario_integral_diario, 2),
        "dias_utilidades": dias_utilidades,
        "dias_bono_vacacional": dias_bono_vacacional,
        "dias_base_anual": dias_base_anual,
        "referencia": "Art. 142 LOTTT",
    }


def calcular_garantia_trimestral(
    salario_mensual: float,
    *,
    dias_utilidades: int = 30,
    dias_bono_vacacional: int = 15,
    dias_base_anual: int = 360,
    dias_garantia: int = 15,
) -> Dict[str, Any]:
    desglose = calcular_salario_integral_diario(
        salario_mensual,
        dias_utilidades=dias_utilidades,
        dias_bono_vacacional=dias_bono_vacacional,
        dias_base_anual=dias_base_anual,
    )
    salario_diario = (
        salario_mensual / 30
        + (salario_mensual / 30) * (dias_utilidades / dias_base_anual)
        + (salario_mensual / 30) * (dias_bono_vacacional / dias_base_anual)
    )
    garantia = salario_diario * dias_garantia  # Art. 142 literal a
    return {
        **desglose,
        "garantia_trimestral": round(garantia, 2),
        "dias_garantia": dias_garantia,
        "estimacion_anual_garantias": round(garantia * 4, 2),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Garantía trimestral Art. 142 LOTTT")
    ap.add_argument("--salario", type=float, required=True, help="Salario mensual")
    ap.add_argument("--utilidades", type=int, default=30)
    ap.add_argument("--bono", type=int, default=15)
    args = ap.parse_args()
    out = calcular_garantia_trimestral(
        args.salario,
        dias_utilidades=args.utilidades,
        dias_bono_vacacional=args.bono,
    )
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
