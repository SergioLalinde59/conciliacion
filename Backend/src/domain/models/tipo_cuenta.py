from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from decimal import Decimal


@dataclass
class TipoCuenta:
    """Entidad de Dominio para Tipos de Cuenta.

    Define los pesos de clasificación y permisos para cada tipo de cuenta.
    Usado por ClasificacionService para determinar la importancia
    de cada campo al buscar movimientos históricos similares.
    """
    id: Optional[int]
    nombre: str
    descripcion: Optional[str] = None
    # Pesos para algoritmo de clasificación
    peso_referencia: int = 100
    peso_descripcion: int = 50
    peso_valor: int = 30
    longitud_min_referencia: int = 8
    # Permisos de operación
    permite_crear_manual: bool = False
    permite_editar: bool = False
    permite_modificar: bool = False
    permite_borrar: bool = False
    permite_clasificar: bool = True
    # Validaciones (aplican en creación manual)
    requiere_descripcion: bool = False
    valor_minimo: Optional[Decimal] = None
    # UX
    responde_enter: bool = False
    # Clasificación avanzada
    referencia_define_tercero: bool = False  # Si TRUE: referencia garantiza tercero, historial solo por referencia
    # Metadatos
    activo: bool = True
    created_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.nombre:
            raise ValueError("El nombre del tipo de cuenta es obligatorio.")
        if self.peso_referencia < 0 or self.peso_descripcion < 0 or self.peso_valor < 0:
            raise ValueError("Los pesos no pueden ser negativos.")

    @property
    def suma_pesos(self) -> int:
        """Suma total de pesos para normalización."""
        return self.peso_referencia + self.peso_descripcion + self.peso_valor

    def calcular_peso_normalizado(self, campo: str) -> float:
        """Calcula el peso normalizado (0-1) para un campo específico."""
        total = self.suma_pesos
        if total == 0:
            return 0.0

        pesos = {
            'referencia': self.peso_referencia,
            'descripcion': self.peso_descripcion,
            'valor': self.peso_valor
        }
        return pesos.get(campo, 0) / total

    def puede_crear(self) -> bool:
        """¿Se puede crear movimiento manualmente?"""
        return self.permite_crear_manual

    def puede_editar(self) -> bool:
        """¿Se puede abrir edición del movimiento?"""
        return self.permite_editar

    def puede_modificar(self) -> bool:
        """¿Se pueden cambiar valores (fecha, valor, descripción)?"""
        return self.permite_modificar

    def puede_borrar(self) -> bool:
        """¿Se puede eliminar el movimiento?"""
        return self.permite_borrar

    def puede_clasificar(self) -> bool:
        """¿Se puede asignar tercero, centro costo, concepto?"""
        return self.permite_clasificar