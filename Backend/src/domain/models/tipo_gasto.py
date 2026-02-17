from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime


@dataclass
class TipoGasto:
    """Entidad de Dominio para tipos de gasto configurables"""
    tipo: str
    descripcion: Optional[str] = None
    indicador_default: Optional[str] = None
    excluir_presupuesto: bool = False
    activo: bool = True
    keywords: List[Dict[str, Any]] = field(default_factory=list)
    prioridad: int = 99
    id: Optional[int] = None
    created_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.tipo:
            raise ValueError("El tipo de gasto es obligatorio")
