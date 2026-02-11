from fastapi import Depends
from src.infrastructure.database.connection import get_db_connection

from src.infrastructure.database.postgres_cuenta_repository import PostgresCuentaRepository
from src.domain.ports.cuenta_repository import CuentaRepository

from src.infrastructure.database.postgres_moneda_repository import PostgresMonedaRepository
from src.domain.ports.moneda_repository import MonedaRepository

from src.infrastructure.database.postgres_tipo_mov_repository import PostgresTipoMovRepository
from src.domain.ports.tipo_mov_repository import TipoMovRepository

from src.infrastructure.database.postgres_tercero_repository import PostgresTerceroRepository
from src.domain.ports.tercero_repository import TerceroRepository

from src.infrastructure.database.postgres_tercero_descripcion_repository import PostgresTerceroDescripcionRepository
from src.domain.ports.tercero_descripcion_repository import TerceroDescripcionRepository

from src.infrastructure.database.postgres_centro_costo_repository import PostgresCentroCostoRepository
from src.domain.ports.centro_costo_repository import CentroCostoRepository

from src.infrastructure.database.postgres_concepto_repository import PostgresConceptoRepository
from src.domain.ports.concepto_repository import ConceptoRepository

from src.infrastructure.database.postgres_movimiento_repository import PostgresMovimientoRepository
from src.domain.ports.movimiento_repository import MovimientoRepository

from src.infrastructure.database.postgres_reglas_repository import PostgresReglasRepository
from src.domain.ports.reglas_repository import ReglasRepository

from src.infrastructure.database.postgres_config_filtro_centro_costo_repository import PostgresConfigFiltroCentroCostoRepository
from src.domain.ports.config_filtro_centro_costo_repository import ConfigFiltroCentroCostoRepository

from src.infrastructure.database.postgres_config_valor_pendiente_repository import PostgresConfigValorPendienteRepository
from src.domain.ports.config_valor_pendiente_repository import ConfigValorPendienteRepository

from src.infrastructure.database.postgres_conciliacion_repository import PostgresConciliacionRepository
from src.domain.ports.conciliacion_repository import ConciliacionRepository

from src.domain.ports.movimiento_extracto_repository import MovimientoExtractoRepository
from src.infrastructure.database.postgres_movimiento_extracto_repository import PostgresMovimientoExtractoRepository

from src.infrastructure.database.postgres_tipo_cuenta_repository import PostgresTipoCuentaRepository
from src.domain.ports.tipo_cuenta_repository import TipoCuentaRepository


def get_cuenta_repository(conn=Depends(get_db_connection)) -> CuentaRepository:
    return PostgresCuentaRepository(conn)

def get_moneda_repository(conn=Depends(get_db_connection)) -> MonedaRepository:
    return PostgresMonedaRepository(conn)

def get_tipo_mov_repository(conn=Depends(get_db_connection)) -> TipoMovRepository:
    return PostgresTipoMovRepository(conn)

def get_tercero_repository(conn=Depends(get_db_connection)) -> TerceroRepository:
    return PostgresTerceroRepository(conn)

def get_tercero_descripcion_repository(conn=Depends(get_db_connection)) -> TerceroDescripcionRepository:
    return PostgresTerceroDescripcionRepository(conn)

def get_centro_costo_repository(conn=Depends(get_db_connection)) -> CentroCostoRepository:
    return PostgresCentroCostoRepository(conn)

def get_concepto_repository(conn=Depends(get_db_connection)) -> ConceptoRepository:
    return PostgresConceptoRepository(conn)

def get_movimiento_repository(conn=Depends(get_db_connection)) -> MovimientoRepository:
    return PostgresMovimientoRepository(conn)

def get_reglas_repository(conn=Depends(get_db_connection)) -> ReglasRepository:
    return PostgresReglasRepository(conn)

def get_config_filtro_centro_costo_repository(conn=Depends(get_db_connection)) -> ConfigFiltroCentroCostoRepository:
    return PostgresConfigFiltroCentroCostoRepository(conn)

def get_config_valor_pendiente_repository(conn=Depends(get_db_connection)) -> ConfigValorPendienteRepository:
    return PostgresConfigValorPendienteRepository(conn)

def get_conciliacion_repository(conn=Depends(get_db_connection)) -> ConciliacionRepository:
    return PostgresConciliacionRepository(conn)

def get_movimiento_extracto_repository(conn=Depends(get_db_connection)) -> MovimientoExtractoRepository:
    return PostgresMovimientoExtractoRepository(conn)

from src.infrastructure.database.postgres_cuenta_extractor_repository import PostgresCuentaExtractorRepository
from src.domain.ports.cuenta_extractor_repository import CuentaExtractorRepository

def get_cuenta_extractor_repository(conn=Depends(get_db_connection)) -> CuentaExtractorRepository:
    return PostgresCuentaExtractorRepository(conn)

def get_tipo_cuenta_repository(conn=Depends(get_db_connection)) -> TipoCuentaRepository:
    return PostgresTipoCuentaRepository(conn)

# Presupuesto Dependencies
from src.infrastructure.database.postgres_presupuesto_repository import PostgresPresupuestoRepository
from src.domain.ports.presupuesto_repository import PresupuestoRepository

from src.infrastructure.database.postgres_presupuesto_detalle_repository import PostgresPresupuestoDetalleRepository
from src.domain.ports.presupuesto_detalle_repository import PresupuestoDetalleRepository

from src.infrastructure.database.postgres_presupuesto_generacion_repository import PostgresPresupuestoGeneracionRepository
from src.domain.ports.presupuesto_generacion_repository import PresupuestoGeneracionRepository

from src.infrastructure.database.postgres_presupuesto_comparacion_repository import PostgresPresupuestoComparacionRepository
from src.domain.ports.presupuesto_comparacion_repository import PresupuestoComparacionRepository

def get_presupuesto_repository(conn=Depends(get_db_connection)) -> PresupuestoRepository:
    return PostgresPresupuestoRepository(conn)

def get_presupuesto_detalle_repository(conn=Depends(get_db_connection)) -> PresupuestoDetalleRepository:
    return PostgresPresupuestoDetalleRepository(conn)

def get_presupuesto_generacion_repository(conn=Depends(get_db_connection)) -> PresupuestoGeneracionRepository:
    return PostgresPresupuestoGeneracionRepository(conn)

def get_presupuesto_comparacion_repository(conn=Depends(get_db_connection)) -> PresupuestoComparacionRepository:
    return PostgresPresupuestoComparacionRepository(conn)

from src.infrastructure.database.postgres_tipo_gasto_repository import PostgresTipoGastoRepository
from src.domain.ports.tipo_gasto_repository import TipoGastoRepository

from src.infrastructure.database.postgres_indicador_economico_repository import PostgresIndicadorEconomicoRepository
from src.domain.ports.indicador_economico_repository import IndicadorEconomicoRepository

from src.infrastructure.database.postgres_regla_presupuesto_repository import PostgresReglaPresupuestoRepository
from src.domain.ports.regla_presupuesto_repository import ReglaPresupuestoRepository

def get_tipo_gasto_repository(conn=Depends(get_db_connection)) -> TipoGastoRepository:
    return PostgresTipoGastoRepository(conn)

def get_indicador_economico_repository(conn=Depends(get_db_connection)) -> IndicadorEconomicoRepository:
    return PostgresIndicadorEconomicoRepository(conn)

def get_regla_presupuesto_repository(conn=Depends(get_db_connection)) -> ReglaPresupuestoRepository:
    return PostgresReglaPresupuestoRepository(conn)

from src.domain.services.presupuesto_generacion_service import PresupuestoGeneracionDomainService

def get_presupuesto_generacion_domain_service() -> PresupuestoGeneracionDomainService:
    return PresupuestoGeneracionDomainService()

from src.application.services.presupuesto_service import PresupuestoService

def get_presupuesto_service(
    presupuesto_repo: PresupuestoRepository = Depends(get_presupuesto_repository),
    detalle_repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository),
    generacion_repo: PresupuestoGeneracionRepository = Depends(get_presupuesto_generacion_repository),
    comparacion_repo: PresupuestoComparacionRepository = Depends(get_presupuesto_comparacion_repository),
    tipo_gasto_repo: TipoGastoRepository = Depends(get_tipo_gasto_repository),
    indicador_repo: IndicadorEconomicoRepository = Depends(get_indicador_economico_repository),
    regla_repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository),
    generacion_service: PresupuestoGeneracionDomainService = Depends(get_presupuesto_generacion_domain_service)
) -> PresupuestoService:
    return PresupuestoService(
        presupuesto_repo, detalle_repo, generacion_repo, comparacion_repo,
        tipo_gasto_repo, indicador_repo, regla_repo, generacion_service
    )

# Matching System Dependencies
from src.infrastructure.database.postgres_movimiento_vinculacion_repository import PostgresMovimientoVinculacionRepository
from src.domain.ports.movimiento_vinculacion_repository import MovimientoVinculacionRepository

from src.infrastructure.database.postgres_configuracion_matching_repository import PostgresConfiguracionMatchingRepository
from src.domain.ports.configuracion_matching_repository import ConfiguracionMatchingRepository

from src.domain.services.matching_service import MatchingService

def get_movimiento_vinculacion_repository(conn=Depends(get_db_connection)) -> MovimientoVinculacionRepository:
    return PostgresMovimientoVinculacionRepository(conn)

def get_configuracion_matching_repository(conn=Depends(get_db_connection)) -> ConfiguracionMatchingRepository:
    return PostgresConfiguracionMatchingRepository(conn)

def get_matching_service() -> MatchingService:
    """
    Retorna una instancia de MatchingService.
    
    MatchingService es un servicio de dominio puro sin estado,
    no requiere repositorios en su constructor.
    """
    return MatchingService()

from src.infrastructure.database.postgres_matching_alias_repository import PostgresMatchingAliasRepository
from src.domain.ports.matching_alias_repository import MatchingAliasRepository

def get_matching_alias_repository(conn=Depends(get_db_connection)) -> MatchingAliasRepository:
    return PostgresMatchingAliasRepository(conn)
from src.domain.services.date_range_service import DateRangeService

def get_date_range_service(
    repo=Depends(get_movimiento_extracto_repository)
) -> DateRangeService:
    return DateRangeService(repo)

from src.domain.services.conciliacion_service import ConciliacionService

def get_conciliacion_service(
    mov_repo: MovimientoRepository = Depends(get_movimiento_repository),
    vinc_repo: MovimientoVinculacionRepository = Depends(get_movimiento_vinculacion_repository),
    conciliacion_repo: ConciliacionRepository = Depends(get_conciliacion_repository),
    date_service: DateRangeService = Depends(get_date_range_service)
) -> ConciliacionService:
    return ConciliacionService(mov_repo, vinc_repo, conciliacion_repo, date_service)

# TRM Dependencies
from src.infrastructure.database.postgres_trm_repository import PostgresTrmRepository
from src.domain.ports.trm_repository import TrmRepository
from src.infrastructure.external.datos_gov_trm_provider import DatosGovTrmProvider
from src.domain.ports.trm_provider import TrmProvider
from src.application.services.trm_application_service import TrmApplicationService

def get_trm_repository(conn=Depends(get_db_connection)) -> TrmRepository:
    return PostgresTrmRepository(conn)

def get_trm_provider() -> TrmProvider:
    return DatosGovTrmProvider()

def get_trm_application_service(
    trm_repo: TrmRepository = Depends(get_trm_repository),
    trm_provider: TrmProvider = Depends(get_trm_provider),
    mov_repo: MovimientoRepository = Depends(get_movimiento_repository)
) -> TrmApplicationService:
    return TrmApplicationService(trm_repo, trm_provider, mov_repo)
