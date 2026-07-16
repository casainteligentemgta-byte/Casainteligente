#!/usr/bin/env python3
"""
Pasivo laboral por trabajador (Supabase + LaborCalculator).

  export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
  python scripts/legal/calculate_worker_pasivo.py --worker-id <uuid>
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from typing import Any, Dict, Optional, Union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from supabase import create_client

from calcular_prestacion_antiguedad import LaborCalculator

# Vistas compatibles (migración 270)
TABLE_WORKERS = "workers"
TABLE_BENEFIT_CONFIGS = "benefit_configs"
TABLE_SALARY_HISTORY = "salary_history"


def _sb():
    url = (
        os.environ.get("SUPABASE_URL", "")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    ).strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise SystemExit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def calculate_worker_pasivo(
    worker_id: str,
    *,
    supabase: Any = None,
    fecha_fin: Optional[date] = None,
) -> Union[Dict[str, Any], str]:
    """
    1) Datos del trabajador, config de beneficios y último salario
    2) LaborCalculator (Arts. 131, 190, 142 LOTTT)
    3) monto_a_provisionar = max(garantía trimestral, retroactivo) — Art. 142
    """
    sb = supabase or _sb()
    as_of = fecha_fin or date.today()

    worker_res = (
        sb.table(TABLE_WORKERS).select("*").eq("id", worker_id).limit(1).execute()
    )
    worker = (worker_res.data or [None])[0]
    if not worker:
        return "Error: No se encontró el trabajador."

    config_res = (
        sb.table(TABLE_BENEFIT_CONFIGS)
        .select("*")
        .eq("worker_id", worker_id)
        .limit(1)
        .execute()
    )
    config = (config_res.data or [None])[0] or {}

    salary_res = (
        sb.table(TABLE_SALARY_HISTORY)
        .select("base_salary, effective_date")
        .eq("worker_id", worker_id)
        .order("effective_date", desc=True)
        .limit(1)
        .execute()
    )
    latest_salary = (salary_res.data or [None])[0]

    if not latest_salary or latest_salary.get("base_salary") is None:
        return "Error: No se encontró historial salarial para este trabajador."

    # Art. 131 LOTTT (utilidades) / Art. 190 LOTTT (bono vacacional)
    calc = LaborCalculator(
        salario_base_mensual=float(latest_salary["base_salary"]),
        dias_utilidades=int(config.get("days_utilidades", 30)),
        dias_bono_vacacional=int(config.get("days_bono_vacacional", 15)),
    )

    join_raw = worker.get("join_date")
    if not join_raw:
        return "Error: El trabajador no tiene join_date / fecha de ingreso."

    fecha_inicio = date.fromisoformat(str(join_raw)[:10])
    trimestral = calc.calcular_garantia_trimestral()
    retroactivo = calc.calcular_retroactivo(
        fecha_inicio=fecha_inicio,
        fecha_fin=as_of,
    )

    return {
        "worker": worker.get("full_name"),
        "worker_id": worker_id,
        "salario_base_mensual": float(latest_salary["base_salary"]),
        "salario_effective_date": latest_salary.get("effective_date"),
        "dias_utilidades": int(config.get("days_utilidades", 30)),
        "dias_bono_vacacional": int(config.get("days_bono_vacacional", 15)),
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": as_of.isoformat(),
        "salario_integral_diario": calc.get_salario_integral_diario(),
        "garantia_trimestral": trimestral,
        "retroactivo_acumulado": retroactivo,
        # Art. 142 LOTTT — provisionar el monto mayor
        "monto_a_provisionar": max(trimestral, retroactivo),
        "referencias": {
            "utilidades": "Art. 131 LOTTT",
            "bono_vacacional": "Art. 190 LOTTT",
            "garantia_y_retroactivo": "Art. 142 LOTTT",
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--worker-id", required=True)
    ap.add_argument("--fecha-fin", default=None, help="YYYY-MM-DD (default: hoy)")
    args = ap.parse_args()
    fin = date.fromisoformat(args.fecha_fin) if args.fecha_fin else None
    out = calculate_worker_pasivo(args.worker_id, fecha_fin=fin)
    if isinstance(out, str):
        print(out, file=sys.stderr)
        return 1
    print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
