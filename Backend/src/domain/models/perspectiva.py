from dataclasses import dataclass, field
from typing import Optional, List

@dataclass
class Perspectiva:
    """Entidad de Dominio para Perspectivas de visualización"""
    nombre: str
    slug: str
    tipo: str  # 'incluir' | 'excluir'
    centro_costo_ids: List[int] = field(default_factory=list)
    siempre_excluir_ids: List[int] = field(default_factory=list)
    es_defecto: bool = False
    orden: int = 0
    activa: bool = True
    id: Optional[int] = None

    def __post_init__(self):
        if not self.nombre:
            raise ValueError("El nombre de la perspectiva es obligatorio.")
        if not self.slug:
            raise ValueError("El slug de la perspectiva es obligatorio.")
        if self.tipo not in ('incluir', 'excluir'):
            raise ValueError("El tipo debe ser 'incluir' o 'excluir'.")
