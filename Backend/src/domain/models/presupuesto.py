from dataclasses import dataclass
from typing import Optional
from datetime import datetime

# Constantes de umbrales — Única fuente de verdad para los defaults
DEFAULT_UMBRAL_NO_REPETITIVO = 4
DEFAULT_UMBRAL_ESTACIONAL = 4
DEFAULT_UMBRAL_PARETO = 5_000_000.0


@dataclass
class Presupuesto:
    """Entidad de Dominio para Presupuesto (maestro anual)"""
    anio: int
    nombre: str
    semaforo_verde_hasta: float
    semaforo_amarillo_hasta: float
    umbral_minimo_mensual: float = 0.0
    umbral_minimo_anual: float = 0.0
    umbral_no_repetitivo: int = DEFAULT_UMBRAL_NO_REPETITIVO
    umbral_estacional: int = DEFAULT_UMBRAL_ESTACIONAL
    umbral_pareto: float = DEFAULT_UMBRAL_PARETO
    cifras_en_millones: bool = False
    version_actual: int = 1
    estado: str = 'borrador'
    id: Optional[int] = None
    notas: Optional[str] = None
    created_at: Optional[datetime] = None

    ESTADOS_VALIDOS = ('borrador', 'activo', 'cerrado')

    def __post_init__(self):
        if not self.nombre:
            raise ValueError("El nombre del presupuesto es obligatorio")
        if self.anio < 2020:
            raise ValueError("El año debe ser mayor o igual a 2020")
        if self.estado not in self.ESTADOS_VALIDOS:
            raise ValueError(f"Estado inválido: {self.estado}. Debe ser uno de {self.ESTADOS_VALIDOS}")
        if self.semaforo_verde_hasta <= 0 or self.semaforo_amarillo_hasta <= 0:
            raise ValueError("Los umbrales del semáforo deben ser mayores a 0")
        if self.semaforo_verde_hasta >= self.semaforo_amarillo_hasta:
            raise ValueError("El umbral verde debe ser menor que el amarillo")
        if self.umbral_minimo_mensual < 0 or self.umbral_minimo_anual < 0:
            raise ValueError("Los umbrales mínimos no pueden ser negativos")

    @property
    def puede_editar(self) -> bool:
        """Solo se puede editar un presupuesto en estado borrador"""
        return self.estado == 'borrador'

    def activar(self):
        """Cambia el estado a activo. Solo desde borrador."""
        if self.estado != 'borrador':
            raise ValueError("Solo un presupuesto en borrador puede activarse")
        self.estado = 'activo'

    def cerrar(self):
        """Cambia el estado a cerrado. Solo desde activo."""
        if self.estado != 'activo':
            raise ValueError("Solo un presupuesto activo puede cerrarse")
        self.estado = 'cerrado'

    def revertir(self):
        """Revierte a borrador. Solo desde activo."""
        if self.estado != 'activo':
            raise ValueError("Solo un presupuesto activo puede revertirse a borrador")
        self.estado = 'borrador'