from typing import Optional
from datetime import date
from decimal import Decimal
from src.domain.ports.trm_repository import TrmRepository
from src.domain.ports.trm_provider import TrmProvider
from src.domain.ports.movimiento_repository import MovimientoRepository
from src.domain.models.trm import Trm
from src.infrastructure.logging.config import logger


class TrmApplicationService:
    """
    Orquesta la obtención de TRM (cache + API externa)
    y su aplicación a movimientos USD.
    """

    def __init__(
        self,
        trm_repo: TrmRepository,
        trm_provider: TrmProvider,
        mov_repo: MovimientoRepository
    ):
        self._trm_repo = trm_repo
        self._trm_provider = trm_provider
        self._mov_repo = mov_repo

    def obtener_trm(self, fecha: date) -> Optional[Trm]:
        """Obtiene TRM: primero cache local, luego API externa."""
        # 1. Cache exacto
        cached = self._trm_repo.obtener_por_fecha(fecha)
        if cached:
            logger.info(f"TRM para {fecha} encontrada en cache: {cached.valor}")
            return cached

        # 2. API externa
        valor = self._trm_provider.obtener_trm(fecha)
        if valor:
            trm = Trm(fecha=fecha, valor=valor)
            saved = self._trm_repo.guardar(trm)
            logger.info(f"TRM para {fecha} obtenida de API y cacheada: {valor}")
            return saved

        # 3. Fallback: más cercana en cache
        cercana = self._trm_repo.obtener_mas_cercana(fecha)
        if cercana:
            logger.warning(f"TRM exacta no disponible para {fecha}, usando cercana: {cercana.fecha} = {cercana.valor}")
        return cercana

    def aplicar_trm_a_cuenta(
        self,
        cuenta_id: int,
        fecha_pago: date,
        fecha_inicio: date,
        fecha_fin: date
    ) -> dict:
        """
        Aplica la TRM de la fecha de pago a los movimientos USD
        de una cuenta en el periodo dado.

        Actualiza encabezado.valor, encabezado.trm y detalle.Valor a COP.

        Returns:
            dict con trm_aplicada, movimientos_actualizados, valor_total_cop
        """
        # 1. Obtener TRM
        trm_obj = self.obtener_trm(fecha_pago)
        if not trm_obj:
            raise ValueError(f"No se pudo obtener la TRM para {fecha_pago}")

        trm_valor = trm_obj.valor

        # 2. Buscar movimientos del periodo para esa cuenta
        movimientos, _ = self._mov_repo.buscar_avanzado(
            cuenta_id=cuenta_id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            limit=None
        )

        # 3. Filtrar solo USD (usd != None y != 0)
        usd_movimientos = [m for m in movimientos if m.usd and m.usd != 0]

        if not usd_movimientos:
            logger.info(f"No se encontraron movimientos USD para cuenta {cuenta_id} en [{fecha_inicio}, {fecha_fin}]")
            return {
                "trm_aplicada": float(trm_valor),
                "fecha_trm": str(trm_obj.fecha),
                "movimientos_actualizados": 0,
                "valor_total_cop": 0.0
            }

        # 4. Aplicar TRM a cada movimiento
        actualizados = 0
        valor_total_cop = Decimal('0')

        for mov in usd_movimientos:
            mov.trm = trm_valor
            mov.trm_provisional = False
            valor_cop = mov.usd * trm_valor
            mov.valor = valor_cop

            # Actualizar detalles
            if len(mov.detalles) == 1:
                mov.detalles[0].valor = valor_cop
            elif mov.detalles:
                # Múltiples detalles: distribuir proporcionalmente si tienen valores,
                # o asignar todo al primero si todos son 0
                valores_previos = [abs(d.valor) for d in mov.detalles]
                suma_previa = sum(valores_previos)

                if suma_previa > 0:
                    for d in mov.detalles:
                        proporcion = abs(d.valor) / suma_previa
                        d.valor = valor_cop * proporcion
                else:
                    # Todos en 0: asignar todo al primer detalle
                    mov.detalles[0].valor = valor_cop
                    logger.warning(
                        f"Movimiento {mov.id}: múltiples detalles con valor 0, "
                        f"asignando {valor_cop} COP al primer detalle"
                    )

            self._mov_repo.guardar(mov)
            actualizados += 1
            valor_total_cop += abs(valor_cop)

        logger.info(
            f"TRM {trm_valor} aplicada a {actualizados} movimientos USD "
            f"de cuenta {cuenta_id}. Total COP: {valor_total_cop}"
        )

        return {
            "trm_aplicada": float(trm_valor),
            "fecha_trm": str(trm_obj.fecha),
            "movimientos_actualizados": actualizados,
            "valor_total_cop": float(valor_total_cop)
        }
