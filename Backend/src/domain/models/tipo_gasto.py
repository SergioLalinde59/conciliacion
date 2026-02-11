from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class TipoGasto:
    """Entidad de Dominio para tipos de gasto configurables"""
    tipo: str
    descripcion: Optional[str] = None
    indicador_default: Optional[str] = None
    excluir_presupuesto: bool = False
    activo: bool = True
    id: Optional[int] = None
    created_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.tipo:
            raise ValueError("El tipo de gasto es obligatorio")
