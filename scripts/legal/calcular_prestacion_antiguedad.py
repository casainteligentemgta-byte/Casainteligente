#!/usr/bin/env python3
"""
LaborCalculator — Art. 142 LOTTT.

  python scripts/legal/calcular_prestacion_antiguedad.py --salario 500
  python scripts/legal/calcular_prestacion_antiguedad.py --salario 500 \\
    --inicio 2020-01-15 --fin 2026-07-16
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from typing import Any, Dict, Optional, Union

try:
    from dateutil.relativedelta import relativedelta
except ImportError as e:
    raise SystemExit("Instale python-dateutil: pip install python-dateutil") from e

DateLike = Union[date, datetime, str]


def _parse_date(value: DateLike) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


class LaborCalculator:
    def __init__(
        self,
        salario_base_mensual: float,
        dias_utilidades: int = 30,
        dias_bono_vacacional: int = 15,
        *,
        dias_base_anual: int = 360,
        dias_garantia_trimestral: int = 15,
        dias_retroactivo_por_anio: int = 60,
    ):
        self.salario_base_mensual = float(salario_base_mensual)
        self.dias_utilidades = dias_utilidades
        self.dias_bono_vacacional = dias_bono_vacacional
        self.dias_base_anual = dias_base_anual
        self.dias_garantia_trimestral = dias_garantia_trimestral
        self.dias_retroactivo_por_anio = dias_retroactivo_por_anio

    def get_salario_integral_diario(self) -> float:
        """
        Calcula el salario integral diario base para prestaciones.
        Aplica: Salario Normal + Alícuotas de Utilidades y Bono Vacacional.
        """
        salario_diario_normal = self.salario_base_mensual / 30
        alicuota_utilidades = (salario_diario_normal * self.dias_utilidades) / self.dias_base_anual
        alicuota_bono = (salario_diario_normal * self.dias_bono_vacacional) / self.dias_base_anual
        return salario_diario_normal + alicuota_utilidades + alicuota_bono

    def calcular_garantia_trimestral(self) -> float:
        """
        Calcula el monto correspondiente a la garantía trimestral (15 días).
        Art. 142 literal a) LOTTT.
        """
        return self.get_salario_integral_diario() * self.dias_garantia_trimestral

    def calcular_retroactivo(self, fecha_inicio: DateLike, fecha_fin: DateLike) -> float:
        """
        Calcula el retroactivo de 60 días por año (o fracción > 6 meses).
        Art. 142 literal f) LOTTT.
        """
        inicio = _parse_date(fecha_inicio)
        fin = _parse_date(fecha_fin)
        if fin < inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        diff = relativedelta(fin, inicio)
        anios_servicio = diff.years + (1 if diff.months > 6 else 0)
        return self.get_salario_integral_diario() * self.dias_retroactivo_por_anio * anios_servicio

    def to_dict(
        self,
        fecha_inicio: Optional[DateLike] = None,
        fecha_fin: Optional[DateLike] = None,
    ) -> Dict[str, Any]:
        sid = self.get_salario_integral_diario()
        salario_diario_normal = self.salario_base_mensual / 30
        out: Dict[str, Any] = {
            "salario_mensual": round(self.salario_base_mensual, 2),
            "salario_diario_base": round(salario_diario_normal, 2),
            "alicuota_utilidades": round(
                (salario_diario_normal * self.dias_utilidades) / self.dias_base_anual, 2
            ),
            "alicuota_bono_vacacional": round(
                (salario_diario_normal * self.dias_bono_vacacional) / self.dias_base_anual, 2
            ),
            "salario_integral_diario": round(sid, 2),
            "dias_utilidades": self.dias_utilidades,
            "dias_bono_vacacional": self.dias_bono_vacacional,
            "dias_base_anual": self.dias_base_anual,
            "referencia": "Art. 142 LOTTT",
            "garantia_trimestral": round(self.calcular_garantia_trimestral(), 2),
            "dias_garantia": self.dias_garantia_trimestral,
            "estimacion_anual_garantias": round(self.calcular_garantia_trimestral() * 4, 2),
            "retroactivo": None,
        }
        if fecha_inicio and fecha_fin:
            inicio = _parse_date(fecha_inicio)
            fin = _parse_date(fecha_fin)
            diff = relativedelta(fin, inicio)
            anios_servicio = diff.years + (1 if diff.months > 6 else 0)
            out["retroactivo"] = {
                "fecha_inicio": inicio.isoformat(),
                "fecha_fin": fin.isoformat(),
                "anios_completos": diff.years,
                "meses_fraccion": diff.months,
                "anios_servicio": anios_servicio,
                "dias_retroactivo_por_anio": self.dias_retroactivo_por_anio,
                "retroactivo": round(self.calcular_retroactivo(inicio, fin), 2),
                "referencia_retroactivo": "Art. 142 literal f) LOTTT",
            }
        return out


# Compat helpers
def calcular_salario_integral_diario(salario_mensual: float, **kwargs: Any) -> Dict[str, Any]:
    calc = LaborCalculator(salario_mensual, **{k: v for k, v in kwargs.items() if k.startswith("dias_")})
    return calc.to_dict()


def calcular_garantia_trimestral(salario_mensual: float, **kwargs: Any) -> Dict[str, Any]:
    return LaborCalculator(salario_mensual, **kwargs).to_dict()


def main() -> int:
    ap = argparse.ArgumentParser(description="LaborCalculator Art. 142 LOTTT")
    ap.add_argument("--salario", type=float, required=True, help="Salario base mensual")
    ap.add_argument("--utilidades", type=int, default=30)
    ap.add_argument("--bono", type=int, default=15)
    ap.add_argument("--inicio", default=None, help="YYYY-MM-DD (retroactivo lit. f)")
    ap.add_argument("--fin", default=None, help="YYYY-MM-DD (retroactivo lit. f)")
    args = ap.parse_args()

    calc = LaborCalculator(
        args.salario,
        dias_utilidades=args.utilidades,
        dias_bono_vacacional=args.bono,
    )
    print(json.dumps(calc.to_dict(args.inicio, args.fin), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
