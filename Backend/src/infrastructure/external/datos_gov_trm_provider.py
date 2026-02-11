import requests
from typing import Optional
from datetime import date
from decimal import Decimal
from src.domain.ports.trm_provider import TrmProvider
from src.infrastructure.logging.config import logger


class DatosGovTrmProvider(TrmProvider):
    """
    Proveedor de TRM desde datos.gov.co (Socrata API).
    Dataset: TRM - Tasa Representativa del Mercado
    Endpoint: https://www.datos.gov.co/resource/ceyp-9c7c.json
    """
    BASE_URL = "https://www.datos.gov.co/resource/ceyp-9c7c.json"
    TIMEOUT = 10

    def obtener_trm(self, fecha: date) -> Optional[Decimal]:
        """Obtiene la TRM para una fecha. Si no hay dato exacto, busca la más cercana anterior."""
        # Intentar fecha exacta
        valor = self._buscar_fecha_exacta(fecha)
        if valor:
            return valor

        # Si no hay exacta (fin de semana, festivo), buscar la más cercana anterior
        return self._buscar_cercana_anterior(fecha)

    def _buscar_fecha_exacta(self, fecha: date) -> Optional[Decimal]:
        try:
            fecha_str = fecha.strftime("%Y-%m-%dT00:00:00.000")
            params = {
                "$where": f"vigenciadesde='{fecha_str}'",
                "$limit": 1
            }
            response = requests.get(self.BASE_URL, params=params, timeout=self.TIMEOUT)
            response.raise_for_status()
            data = response.json()

            if data:
                return Decimal(str(data[0]['valor']))
            return None
        except Exception as e:
            logger.error(f"Error obteniendo TRM exacta para {fecha}: {e}")
            return None

    def _buscar_cercana_anterior(self, fecha: date) -> Optional[Decimal]:
        try:
            fecha_str = fecha.strftime("%Y-%m-%dT00:00:00.000")
            params = {
                "$where": f"vigenciadesde<='{fecha_str}'",
                "$order": "vigenciadesde DESC",
                "$limit": 1
            }
            response = requests.get(self.BASE_URL, params=params, timeout=self.TIMEOUT)
            response.raise_for_status()
            data = response.json()

            if data:
                return Decimal(str(data[0]['valor']))
            return None
        except Exception as e:
            logger.error(f"Error obteniendo TRM cercana para {fecha}: {e}")
            return None
