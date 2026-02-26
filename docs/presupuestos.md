# Presupuestos — Modulo de PH360

**Plataforma**: PH360 — Gestion Integral de Propiedad Horizontal
**Microservicio**: `backend-budget`
**Fecha**: 2026-02-22

---

## Resumen Ejecutivo

El modulo de **Presupuestos** permite a las administraciones de propiedad horizontal planificar, generar, ajustar y controlar la ejecucion de su presupuesto anual. El sistema genera automaticamente el presupuesto del proximo ano basandose en los datos historicos reales, aplica indicadores economicos (IPC, incrementos salariales) y ofrece comparaciones detalladas de presupuesto vs. ejecucion real con alertas por semaforo.

---

## 1. Generacion Inteligente de Presupuestos

### Generacion automatica desde datos historicos
- El sistema analiza los **movimientos reales del ano anterior** y genera automaticamente el presupuesto del nuevo ano.
- Agrupacion por Centro de Costo, Concepto y Tercero para cada mes.
- Identificacion automatica de gastos fijos, variables, estacionales y no repetitivos.

### Clasificacion automatica de gastos
El sistema clasifica automaticamente cada rubro presupuestal en uno de cinco tipos:

| Tipo de Gasto | Descripcion | Ejemplo PH |
|---------------|-------------|------------|
| **Fijo** | Gasto constante mes a mes | Administracion, vigilancia, seguros |
| **Variable** | Gasto que fluctua mensualmente | Servicios publicos, mantenimientos menores |
| **Salarial** | Relacionado con nomina y prestaciones | Salarios, seguridad social, prestaciones |
| **Estacional** | Concentrado en meses especificos | Prima de diciembre, impuesto predial |
| **No Repetitivo** | Gasto que ocurrio una sola vez | Reparacion extraordinaria, compra de equipo |

### Indicadores economicos integrados
- Aplicacion automatica de incrementos basados en indicadores economicos configurados:
  - **IPC** (Indice de Precios al Consumidor): para gastos fijos y variables.
  - **Incremento salarial**: para gastos de nomina y prestaciones.
  - **TRM**: para gastos en dolares.
  - Indicadores personalizados por ano.
- Cada tipo de gasto se asocia a un indicador y un factor de ajuste.

### Pre-visualizacion antes de generar
- Vista previa completa del presupuesto propuesto **sin guardar datos**.
- Muestra: items regulares, items no repetitivos excluidos, montos fijos faltantes.
- Permite revisar y validar antes de confirmar la generacion.

---

## 2. Reglas de Presupuesto

### Sistema de reglas por tres niveles de prioridad

```
Nivel 1: Regla especifica (Centro de Costo + Concepto)     ← Maxima prioridad
Nivel 2: Regla por Centro de Costo (aplica a todos sus conceptos)
Nivel 3: Regla global (aplica a todo)
Nivel 4: Auto-clasificacion inteligente (si no hay regla)   ← Ultima opcion
```

### Configuracion de reglas
- Cada regla define: tipo de gasto, indicador economico, factor de ajuste y opcionalmente un monto fijo mensual.
- Creacion individual o por lotes.
- Al modificar reglas, el presupuesto se **regenera automaticamente** reflejando los cambios.

### Vista previa de clasificacion
- Panel que muestra como se clasificaria cada combinacion Centro de Costo / Concepto.
- Indica: regla aplicada, nivel de coincidencia, tipo propuesto, indicador y factor.
- Permite crear reglas directamente desde la vista previa.

### Simulacion de impacto
- Antes de aplicar cambios en las reglas, el sistema simula el impacto en el presupuesto.
- Comparacion lado a lado: presupuesto actual vs. proyectado con las nuevas reglas.
- Ordenado por impacto (Pareto) para enfocarse en los rubros mas significativos.

---

## 3. Gestion y Ajustes del Presupuesto

### Ciclo de vida del presupuesto

```
BORRADOR  ──►  ACTIVO  ──►  CERRADO
  Editable      Vigente      Archivado
                  │
                  ▼
              BORRADOR (revertir)
```

| Estado | Significado | Acciones |
|--------|-------------|----------|
| **Borrador** | En preparacion, se puede modificar libremente | Editar, generar, ajustar, eliminar |
| **Activo** | Presupuesto vigente del ano (solo 1 por ano) | Comparar vs real, ajustes menores |
| **Cerrado** | Archivado al finalizar el ano | Solo lectura |

### Tipos de ajustes

#### Ajuste global
- Aplica un porcentaje de incremento o decremento a **todas** las lineas del presupuesto.
- Ejemplo: "Incrementar todo el presupuesto un 8% por inflacion".

#### Ajuste por Centro de Costo
- Aplica un porcentaje solo a un centro de costo especifico.
- Ejemplo: "Incrementar Vigilancia un 12% por nuevo contrato de seguridad".

#### Ajuste por linea individual
- Modifica el monto de una linea especifica del presupuesto.
- Util para correcciones puntuales o adiciones extraordinarias.

### Detalle presupuestal
- Cada linea del presupuesto incluye:
  - **Monto presupuestado**: valor base generado.
  - **Monto ajustado**: valor revisado (si se aplico ajuste).
  - **Monto efectivo**: el valor que aplica (ajustado si existe, sino el base).
  - **Monto base**: referencia historica del ano anterior.
  - Desglose mensual (enero a diciembre).
  - Direccion: egreso o ingreso.

---

## 4. Versionado del Presupuesto

### Control de versiones completo
- Cada vez que se regenera el presupuesto se crea una **nueva version** sin eliminar las anteriores.
- Registro automatico: fecha de generacion, cantidad de lineas, total presupuestado, ano fuente.
- Las consultas siempre operan sobre la version mas reciente.

### Comparacion entre versiones
- Comparacion visual entre cualquier par de versiones.
- Clasifica cada rubro como: **cambiado**, **nuevo**, **eliminado** o **sin cambios**.
- Muestra delta absoluto y porcentual entre versiones.
- Permite entender el impacto de cada iteracion del presupuesto.

---

## 5. Presupuesto vs. Real (Ejecucion Presupuestal)

### Comparacion multi-nivel con drill-down
El reporte principal permite navegar en profundidad creciente:

```
Nivel 1: Centro de Costo          (ej: Servicios Publicos)
  └─ Nivel 2: Concepto            (ej: Energia Electrica)
       └─ Nivel 3: Tercero        (ej: EPM)
            └─ Nivel 4: Movimientos individuales
```

En cada nivel se muestra:
- **Presupuestado**: monto planificado.
- **Ejecutado**: monto real gastado/recibido.
- **Variacion**: diferencia en pesos.
- **Variacion %**: diferencia porcentual.
- **Semaforo**: indicador visual de desviacion.

### Sistema de semaforos

| Color | Significado | Rango por defecto |
|-------|-------------|-------------------|
| Verde | Ejecucion dentro de lo esperado | Variacion ≤ 5% |
| Amarillo | Desviacion moderada, requiere atencion | Variacion entre 5% y 15% |
| Rojo | Desviacion significativa, requiere accion | Variacion > 15% |

- Los umbrales son **configurables** por cada presupuesto.
- Se aplican tanto a egresos como a ingresos.

### Resumen mensual
- Comparacion mes a mes del presupuesto vs. ejecucion real.
- Acumulado del ano.
- Semaforo por cada mes.
- Exportacion a **Excel** para presentacion en asamblea.

---

## 6. Analitica Avanzada

### Gastos sin presupuesto
- Identifica gastos ejecutados en el ano actual que **no tienen linea presupuestal**.
- Categoriza: sin regla de clasificacion, no repetitivo (excluido intencionalmente), o pendiente de regeneracion.
- Alerta visual en el dashboard para tomar accion.

### Reglas pendientes
- Deteccion de reglas configuradas que aun no tienen lineas en el presupuesto.
- Banner de alerta con conteo de reglas pendientes.
- Acceso directo para crear las lineas faltantes.

### Comparativo de cifras
- Cruce de tres fuentes: flujo de caja, presupuesto vs. real e impacto de reglas.
- Identifica inconsistencias entre diferentes vistas de los datos financieros.
- Herramienta de validacion de integridad del presupuesto.

### Exclusiones inteligentes
- Configuracion de centros de costo excluidos de la generacion automatica.
- Filtros globales y por presupuesto individual.
- Los items no repetitivos se excluyen automaticamente (con opcion de incluirlos manualmente).

---

## 7. Tableros y Dashboards

### Widget de ejecucion del mes actual
- Porcentaje de consumo del presupuesto mensual.
- Presupuestado vs. ejecutado con semaforo.
- Dias restantes del mes.
- Alerta si no hay presupuesto activo.

### Resumen de 3 meses
- Ultimos 3 meses con presupuestado, ejecutado y variacion.
- Vision rapida de tendencia.

### Grafico Presupuesto vs. Real
- Comparacion visual por centro de costo.
- Grafico de barras interactivo.
- Top centros de costo con mayor desviacion.

### Integracion con flujo de caja
- Presupuesto superpuesto con flujo de caja real.
- Analisis de tendencia mensual.
- Proyeccion financiera.

---

## 8. Configuracion del Modulo

### Parametros del presupuesto
| Parametro | Descripcion | Valor por defecto |
|-----------|-------------|-------------------|
| Semaforo verde | Umbral maximo para estado verde | 5% |
| Semaforo amarillo | Umbral maximo para estado amarillo | 15% |
| Umbral no repetitivo | Meses minimos de ocurrencia para considerar un gasto como recurrente | 3 meses |
| Umbral estacional | Meses minimos para clasificar como estacional | 3 meses |
| Umbral minimo mensual | Materialidad minima mensual para incluir en presupuesto | Configurable |
| Umbral minimo anual | Materialidad minima anual | Configurable |
| Umbral Pareto | Porcentaje de corte para analisis de impacto | Configurable |
| Cifras en millones | Formato de visualizacion | Si/No |

### Tipos de gasto
- Catalogo configurable con indicador economico por defecto.
- Palabras clave para auto-deteccion (ej: "SALARIO", "PRESTACION" → Salarial).
- Prioridad de matching cuando multiples tipos coinciden.
- Opcion de excluir tipos del presupuesto.

### Indicadores economicos
- Configuracion por ano: codigo, nombre, porcentaje.
- Multiples indicadores por ano (IPC, SMLV, rangos salariales).
- Notas explicativas para contexto.

---

## 9. Integracion con PH360

### Arquitectura de microservicios
- Microservicio independiente (`backend-budget`) integrado en la plataforma PH360.
- Se alimenta de los movimientos clasificados del modulo de **Conciliacion** via eventos Kafka.
- Mantiene un modelo de lectura optimizado (`movement_summary`) para calculos rapidos de ejecucion.

### Flujo de datos

```
Conciliacion                           Presupuestos
┌──────────────┐    Kafka Events    ┌──────────────────┐
│ Movimiento   │ ──────────────────►│ movement_summary  │
│ clasificado  │                    │ (read model CQRS) │
│              │                    │                   │
│ Movimiento   │ ──────────────────►│ Recalcula totales │
│ reclasificado│                    │ por CC/Concepto   │
│              │                    │ /Tercero/Mes      │
│ Movimiento   │ ──────────────────►│                   │
│ eliminado    │                    │ Alimenta reportes │
│              │                    │ Ppto vs Real      │
│ Carga masiva │ ──────────────────►│                   │
└──────────────┘                    └──────────────────┘
```

### Seguridad y permisos
- Autenticacion via JWT integrada con el modulo IAM de PH360.
- Control de acceso basado en roles (RBAC).
- Segmentacion por `property_id`: cada copropiedad ve solo sus datos.

### Independencia operativa
- El modulo de presupuestos funciona de forma autonoma.
- Si el modulo de conciliacion no esta disponible, el presupuesto sigue operando con los datos ya sincronizados.
- Idempotencia en el consumo de eventos (procesamiento exactly-once).

---

## Beneficios para la Administracion de Propiedad Horizontal

| Beneficio | Descripcion |
|-----------|-------------|
| **Generacion automatica** | El presupuesto del proximo ano se genera en minutos, no en semanas |
| **Basado en datos reales** | Parte de los gastos e ingresos reales del ano anterior, no de estimaciones |
| **Indicadores economicos** | Aplica automaticamente IPC, incrementos salariales y otros ajustes |
| **Control de ejecucion** | Semaforos visuales para detectar desviaciones a tiempo |
| **Transparencia** | Reportes claros para presentar en asamblea de copropietarios |
| **Versionado** | Historial completo de cada iteracion del presupuesto |
| **Multi-nivel** | Drill-down desde centro de costo hasta el movimiento individual |
| **Exportable** | Reportes exportables a Excel para presentaciones formales |
| **Multi-copropiedad** | Cada propiedad horizontal opera de forma aislada e independiente |
| **Auditoria** | Trazabilidad completa de generaciones, ajustes y aprobaciones |

---

## Caso de Uso: Ciclo Presupuestal Anual

### 1. Preparacion (octubre-noviembre)
1. El administrador configura los indicadores economicos del proximo ano (IPC proyectado, incremento salarial).
2. Revisa y ajusta las reglas de clasificacion de gastos.
3. Genera un presupuesto en modo **borrador** con pre-visualizacion.
4. Revisa el resultado, ajusta reglas y regenera hasta quedar conforme.

### 2. Aprobacion (noviembre-diciembre)
5. Exporta el presupuesto a Excel para presentar en asamblea.
6. Aplica ajustes solicitados por la asamblea (global o por rubro).
7. **Activa** el presupuesto como vigente para el nuevo ano.

### 3. Seguimiento (enero-diciembre)
8. Cada mes, el dashboard muestra automaticamente el estado de ejecucion.
9. Los semaforos alertan sobre desviaciones significativas.
10. El administrador puede hacer ajustes puntuales si hay cambios en contratos o servicios.

### 4. Cierre (diciembre)
11. Se revisa la ejecucion anual completa.
12. Se **cierra** el presupuesto del ano.
13. Se inicia el ciclo para el siguiente ano.