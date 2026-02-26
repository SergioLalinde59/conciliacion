# Conciliación Bancaria Inteligente

> Sistema integral de gestión financiera personal con IA

---

## El Problema

- Conciliar extractos bancarios manualmente consume horas cada mes
- Clasificar gastos es tedioso y propenso a errores
- No hay visibilidad en tiempo real del presupuesto vs gasto real
- Múltiples cuentas y monedas dificultan tener una foto consolidada

---

## La Solución

Un sistema que **automatiza** la conciliación bancaria, **clasifica inteligentemente** cada transacción y **controla** el presupuesto con indicadores económicos reales.

---

## Módulos Principales

### 1. Dashboard Financiero

- KPIs en tiempo real: Ingresos, Egresos, Flujo Neto, Presupuesto
- Widget de consumo presupuestal con semáforo (verde/amarillo/rojo)
- Gráfico de flujo de caja mensual con overlay de presupuesto
- Top gastos por centro de costo
- Filtros por período: Mes, 3M, 6M, YTD

### 2. Carga Automática de Extractos

- Sube el PDF del banco y el sistema **extrae automáticamente** los movimientos
- Extractores configurables por entidad bancaria
- Validación de saldos contra el extracto
- Soporte multi-moneda (COP, USD) con TRM automática

### 3. Clasificación Inteligente (IA)

Algoritmo de 5 niveles que aprende de tu historial:

1. **Reglas estáticas** - Asignación automática por patrones
2. **Referencia** - Coincidencia por número de referencia
3. **Semántica** - Análisis de descripción del movimiento
4. **Valor** - Patrones por monto
5. **Fallback** - Sugerencia por categoría general

- Pesos configurables por tipo de cuenta
- Clasificación batch para transacciones similares
- Creación de terceros al vuelo

### 4. Matching Inteligente (Conciliación)

- Cruza automáticamente extracto bancario vs movimientos del sistema
- Score compuesto: fecha + valor + descripción
- Umbrales: **OK** (>95%), **Probable** (>70%)
- Integridad 1-a-1 garantizada
- Match/unmatch manual cuando se requiera

### 5. Presupuesto con Indicadores Económicos

- **Generación inteligente**: clasifica gastos por tipo (fijo, variable, salarial, estacional)
- **Indicadores reales**: IPC, aumento salario mínimo, ajustes salariales por rango
- **Fórmula**: `presupuesto = base × (1 + (indicador + ajuste) / 100)`
- **Reglas jerárquicas**: CC+Concepto > CC > Global > Default
- **Wizard de 3 pasos**: Configurar > Previsualizar > Generar
- **Detección automática** de gastos no repetitivos (se excluyen del presupuesto)

### 6. Reportes y Drill-Down

- Egresos por Centro de Costo con drill-down a 3 niveles (CC > Concepto > Tercero)
- Presupuesto vs Real con semáforo y variación porcentual
- Ejecución mensual acumulada
- Comparativo entre períodos
- Exportación a Excel

### 7. Gestión Multi-Cuenta y Multi-Moneda

| Tipo Cuenta | Carga Movimientos | Clasificar | Conciliar |
|-------------|:-:|:-:|:-:|
| Efectivo | Manual | Si | No |
| Bancaria | PDF | Si | Si |
| Tarjeta Crédito | PDF | Si | Si |
| Inversiones | PDF | Si | Si |

- Cuentas USD: TRM provisional automática (Banco de la República), TRM definitiva al pagar

---

## Diferenciadores Clave

| Característica | Beneficio |
|---|---|
| Clasificación con IA | Menos de 5 seg por transacción vs minutos manual |
| Matching automático | Conciliación en segundos, no en horas |
| Presupuesto inteligente | Ajustado a inflación y salarios reales de Colombia |
| Drill-down 3 niveles | De resumen ejecutivo a detalle de transacción en 3 clics |
| Multi-moneda | USD con conversión automática y TRM del Banco de la República |
| Extractores PDF | Soporte para múltiples bancos colombianos |

---

## Arquitectura

- **Backend**: Python + FastAPI (arquitectura hexagonal)
- **Frontend**: React + TypeScript + TailwindCSS
- **BD**: PostgreSQL
- **Despliegue**: Docker Compose (un comando)

---

## En Números

- **42+ pantallas** funcionales
- **5 niveles** de clasificación inteligente
- **6 tipos de gasto** en presupuesto
- **4 indicadores económicos** integrados
- **3 niveles** de drill-down en reportes
- **0 configuración manual** para empezar - wizard guiado

---

*Sistema diseñado para el contexto financiero colombiano: TRM, IPC, SMLV, extractos de bancos locales.*