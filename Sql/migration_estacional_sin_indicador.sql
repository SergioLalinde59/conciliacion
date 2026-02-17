-- =====================================================
-- MIGRACION: Estacional sin indicador económico
-- Fecha: 2026-02-15
-- Propósito: Los gastos estacionales se tratan como fijos
--            en cuanto a indicadores: su presupuesto es el
--            total anual histórico prorrateado a 12 meses,
--            sin aplicar ningún indicador económico.
-- =====================================================

-- Estacional ya no sugiere indicador por defecto
UPDATE tipos_gasto SET indicador_default = NULL WHERE tipo = 'Estacional';

-- Verificación
SELECT tipo, indicador_default, excluir_presupuesto FROM tipos_gasto ORDER BY id;
