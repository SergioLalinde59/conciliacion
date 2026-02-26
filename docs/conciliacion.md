# Conciliacion Bancaria — Modulo de PH360

**Plataforma**: PH360 — Gestion Integral de Propiedad Horizontal
**Microservicio**: `backend-conciliation`
**Fecha**: 2026-02-22

---

## Resumen Ejecutivo

El modulo de **Conciliacion Bancaria** automatiza el proceso de verificacion y cruce entre los movimientos registrados en el sistema contable de la copropiedad y los extractos bancarios emitidos por las entidades financieras. Reemplaza el proceso manual en hojas de calculo, reduciendo errores, ahorrando tiempo y garantizando trazabilidad completa.

---

## 1. Carga y Procesamiento de Extractos Bancarios

### Carga automatica desde PDF
- Carga de extractos bancarios directamente desde archivos **PDF** emitidos por los bancos.
- Soporte para multiples formatos bancarios (Bancolombia, y extensible a otros bancos colombianos).
- Extraccion automatica de cada linea de movimiento: fecha, descripcion, referencia, valor y saldo acumulado.

### Validacion cruzada automatica
- Calculo automatico de totales: saldo anterior, entradas, salidas y saldo final.
- Comparacion de los totales extraidos del PDF contra los totales calculados linea a linea.
- Deteccion inmediata de discrepancias entre el resumen del banco y los movimientos detallados.

### Edicion y correccion
- Edicion individual de movimientos extraidos cuando el OCR o la extraccion automatica presenta errores.
- Recalculo automatico de totales despues de cada modificacion.
- Deteccion y eliminacion de duplicados.

---

## 2. Gestion de Movimientos del Sistema

### Registro de movimientos
- Registro de movimientos contables con clasificacion por **Centro de Costo**, **Concepto** y **Tercero**.
- Soporte para carga masiva desde archivos Excel/CSV.
- Creacion manual de movimientos para cuentas de efectivo.
- Cada movimiento incluye: fecha, descripcion, referencia, valor en COP, valor en USD y TRM.

### Clasificacion automatica
- Reglas de clasificacion configurables por patron de texto.
- Cuando un movimiento bancario llega, el sistema sugiere automaticamente el tercero, centro de costo y concepto basandose en reglas predefinidas.
- Reduccion significativa del tiempo de clasificacion manual.

### Permisos por tipo de cuenta
- Cada tipo de cuenta (Bancaria, Efectivo, Tarjeta de Credito, Inversiones) tiene permisos configurables.
- Control granular: crear, editar, eliminar, clasificar movimientos.
- Las cuentas bancarias solo permiten clasificar; las de efectivo permiten operaciones completas.

---

## 3. Conciliacion Inteligente (Matching)

### Algoritmo de conciliacion automatica
- Cruce automatico entre movimientos del extracto bancario y movimientos del sistema contable.
- **Algoritmo ponderado multi-criterio** que evalua:
  - **Fecha**: tolerancia configurable (±1 dia por defecto).
  - **Valor**: tolerancia monetaria configurable.
  - **Descripcion**: similitud de texto con normalizacion y alias.
- Cada cruce recibe un **puntaje de confianza** de 0 a 100%.

### Estados del cruce
| Estado | Significado |
|--------|-------------|
| **OK** | Cruce confirmado con alta confianza (>95%) |
| **PROBABLE** | Cruce probable que requiere revision del usuario (70-95%) |
| **SIN MATCH** | No se encontro correspondencia en el sistema |
| **MANUAL** | Vinculado manualmente por el usuario |
| **IGNORADO** | Movimiento marcado como no relevante |

### Vinculacion manual
- Para los casos donde el algoritmo no logra encontrar el cruce, el usuario puede vincular manualmente un movimiento del extracto con uno del sistema.
- Registro de justificacion/notas por cada vinculacion manual.
- Desvinculacion individual o masiva cuando se requiera corregir.

### Sistema de alias y normalizacion
- Configuracion de alias por cuenta bancaria para traducir descripciones del extracto a terminos del sistema.
- Ejemplo: El banco registra "TRANSF ELECTRONICA" y el sistema lo normaliza a "Transferencia EPM".
- Mejora progresiva de la precision del matching automatico.

---

## 4. Validacion de Integridad (Cuadre)

### Checklist de integridad
El sistema verifica automaticamente que la conciliacion cumpla **todas** las condiciones para considerarse cuadrada:

| Validacion | Descripcion |
|------------|-------------|
| Balance de ingresos | Total entradas del sistema = Total entradas del extracto |
| Balance de egresos | Total salidas del sistema = Total salidas del extracto |
| Volumen | Misma cantidad de movimientos en ambos lados |
| Vinculacion completa | Cero movimientos sin cruzar |
| Sin pendientes | Ningun movimiento en estado PROBABLE o SIN MATCH |
| Relacion 1 a 1 | Cada movimiento del sistema ligado a exactamente uno del extracto |

### Deteccion de anomalias
- Identificacion automatica de vinculaciones 1-a-muchos (un movimiento del sistema ligado a varios del extracto).
- Alertas cuando los totales no coinciden.
- Opcion de crear movimientos faltantes desde items no cruzados del extracto.

---

## 5. Semaforo de Estado (Flujo de Aprobacion)

### Ciclo de vida de la conciliacion mensual

```
ROJO (Pendiente)  ──►  AMARILLO (Cuadrado)  ──►  VERDE (Conciliado)
    Editando               Listo para cerrar          Periodo cerrado
```

| Estado | Color | Significado | Acciones permitidas |
|--------|-------|-------------|---------------------|
| **PENDIENTE** | Rojo | En proceso, diferencias pendientes | Editar, crear, vincular, desvincular |
| **CUADRADO** | Amarillo | Todas las validaciones pasan | Aprobar y cerrar |
| **CONCILIADO** | Verde | Periodo formalmente cerrado | Solo lectura |

### Cierre de periodo
- Una vez aprobada, la conciliacion queda **bloqueada**: no se pueden modificar movimientos, crear vinculos ni cargar extractos para ese periodo.
- Solo un administrador puede reabrir un periodo cerrado.
- Garantiza la integridad del historico para auditorias.

---

## 6. Tableros y Reportes

### Dashboard de conciliacion
- Vista consolidada de **todas las cuentas** con su estado de conciliacion por mes.
- Indicador visual tipo semaforo para identificar rapidamente cuentas pendientes.
- Filtros por cuenta y rango de fechas.

### Vista de comparacion detallada
- Tablas lado a lado: movimientos del sistema vs. movimientos del extracto.
- Estadisticas de comparacion:
  - Total de movimientos por fuente.
  - Total de ingresos y egresos.
  - Saldo neto.
  - Seguimiento de montos en USD.
  - Desglose de diferencias.

### Archivo de extractos
- Consulta de PDFs cargados historicamente.
- Navegacion por periodos y cuentas.

---

## 7. Datos Maestros

### Cuentas bancarias
- Registro de cuentas con configuracion de permisos de carga y conciliacion.
- Vinculacion con las cuentas bancarias registradas en el modulo de pagos de PH360.
- Soporte multi-moneda (COP, USD).

### Centros de costo
- Agrupacion jerarquica de gastos e ingresos de la copropiedad.
- Ejemplos: Administracion, Vigilancia, Aseo, Mantenimiento, Zonas Comunes.

### Conceptos
- Subcategorias dentro de cada centro de costo.
- Ejemplo: Centro de Costo "Servicios Publicos" → Conceptos: Agua, Energia, Gas, Telefonia.

### Terceros
- Proveedores y pagadores identificados en los extractos bancarios.
- Sistema de **alias multiples** por tercero para mejorar la clasificacion automatica.
- Ejemplo: Tercero "EPM" con alias: "EMPRESAS PUBLICAS", "EPM MEDELLIN", "TRANSF EPM".

---

## 8. Configuracion Avanzada

### Parametros de matching
- Tolerancia de valor (monto maximo de diferencia aceptable).
- Similitud minima de descripcion.
- Pesos de ponderacion para fecha, valor y descripcion.
- Umbrales de clasificacion (OK vs. PROBABLE).

### Extractores por cuenta
- Configuracion del modulo de extraccion PDF por cada cuenta bancaria.
- Extensible para agregar nuevos bancos sin modificar el codigo existente.

### Filtros de dashboard
- Configuracion de centros de costo excluidos de reportes y dashboards.
- Marcadores de valores "pendiente de clasificar".

---

## 9. Integracion con PH360

### Arquitectura de microservicios
- Microservicio independiente (`backend-conciliation`) integrado en la plataforma PH360.
- Comunicacion por eventos Kafka con otros modulos (especialmente Presupuestos).
- Segmentacion por `property_id` (cada copropiedad ve solo sus datos).

### Seguridad y permisos
- Autenticacion via JWT integrada con el modulo IAM de PH360.
- Control de acceso basado en roles (RBAC).
- Permisos granulares: quien puede cargar extractos, conciliar, cerrar periodos.

### Eventos publicados
El modulo de conciliacion emite eventos que otros microservicios consumen:

| Evento | Descripcion |
|--------|-------------|
| Movimiento clasificado | Cuando se asigna CC/concepto/tercero a un movimiento |
| Movimiento reclasificado | Cuando se cambia la clasificacion de un movimiento |
| Movimiento eliminado | Cuando se elimina un movimiento del sistema |
| Monto actualizado | Cuando se modifica el valor de un movimiento |
| Carga masiva | Cuando se cargan multiples movimientos por archivo |

---

## Beneficios para la Administracion de Propiedad Horizontal

| Beneficio | Descripcion |
|-----------|-------------|
| **Ahorro de tiempo** | Reduce el proceso de conciliacion mensual de horas a minutos |
| **Reduccion de errores** | Elimina errores humanos del cruce manual en hojas de calculo |
| **Trazabilidad** | Registro completo de quien concilio, cuando y como |
| **Control** | Flujo de aprobacion con cierre de periodos que impide modificaciones |
| **Visibilidad** | Dashboards en tiempo real del estado de cada cuenta |
| **Multi-copropiedad** | Cada propiedad horizontal opera de forma aislada e independiente |
| **Auditoria** | Historico completo de extractos, movimientos y vinculaciones |
| **Escalabilidad** | Soporte para multiples cuentas, monedas y bancos |