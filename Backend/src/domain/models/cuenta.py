from dataclasses import dataclass
from typing import Optional
from decimal import Decimal


@dataclass
class Cuenta:
    """Entidad de Dominio para Cuentas"""
    cuentaid: Optional[int]
    cuenta: str
    activa: bool = True
    permite_carga: bool = False
    permite_conciliar: bool = False
    # FK a tipo_cuenta
    tipo_cuenta_id: Optional[int] = None
    # Campos denormalizados (vienen del JOIN con tipo_cuenta)
    tipo_cuenta_nombre: Optional[str] = None
    # Pesos para algoritmo de clasificación
    peso_referencia: int = 100
    peso_descripcion: int = 50
    peso_valor: int = 30
    longitud_min_referencia: int = 8
    # Permisos de operación (del tipo_cuenta)
    permite_crear_manual: bool = False
    permite_editar: bool = False
    permite_modificar: bool = False
    permite_borrar: bool = False
    permite_clasificar: bool = True
    # Validaciones (del tipo_cuenta)
    requiere_descripcion: bool = False
    valor_minimo: Optional[Decimal] = None
    # UX (del tipo_cuenta)
    responde_enter: bool = False
    # Clasificación avanzada (del tipo_cuenta)
    referencia_define_tercero: bool = False

    def __post_init__(self):
        if not self.cuenta:
            raise ValueError("El nombre de la cuenta es obligatorio.")

    @property
    def suma_pesos(self) -> int:
        """Suma total de pesos para normalización."""
        return self.peso_referencia + self.peso_descripcion + self.peso_valor

    def obtener_pesos_clasificacion(self) -> dict:
        """Retorna los pesos de clasificación como diccionario."""
        return {
            'peso_referencia': self.peso_referencia,
            'peso_descripcion': self.peso_descripcion,
            'peso_valor': self.peso_valor,
            'longitud_min_referencia': self.longitud_min_referencia,
            'tipo_cuenta_nombre': self.tipo_cuenta_nombre,
            'referencia_define_tercero': self.referencia_define_tercero
        }

    def obtener_configuracion_tipo(self) -> dict:
        """Retorna la configuración completa del tipo de cuenta."""
        return {
            'tipo_cuenta_id': self.tipo_cuenta_id,
            'tipo_cuenta_nombre': self.tipo_cuenta_nombre,
            # Permisos
            'permite_crear_manual': self.permite_crear_manual,
            'permite_editar': self.permite_editar,
            'permite_modificar': self.permite_modificar,
            'permite_borrar': self.permite_borrar,
            'permite_clasificar': self.permite_clasificar,
            # Validaciones
            'requiere_descripcion': self.requiere_descripcion,
            'valor_minimo': float(self.valor_minimo) if self.valor_minimo else None,
            # UX
            'responde_enter': self.responde_enter
        }
