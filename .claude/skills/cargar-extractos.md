# Skill: Cargar Extractos

> Documentación completa de la funcionalidad "Cargar Extracto Bancario" del sistema de conciliación bancaria.

## Resumen

Esta funcionalidad permite cargar **extractos bancarios mensuales** (PDFs) al sistema. A diferencia de "Cargar Movimientos" (que carga transacciones individuales), aquí se carga el **resumen oficial del banco** con saldos y se valida que los movimientos parseados coincidan contablemente con las cifras del encabezado del extracto.

**Regla de Oro**: Los registros del extracto bancario **NO SE EDITAN** excepto para corregir errores de lectura del PDF (OCR).

---

## Arquitectura del Flujo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  UploadExtractoPage.tsx                                                     │
│    ├─ Selección de cuenta (SelectorCuenta)                                  │
│    ├─ Upload PDF o selección desde servidor local                           │
│    ├─ Botón "Analizar" → apiService.conciliacion.analizarExtracto()         │
│    │    └─ Para archivos locales: procesarLocal('extractos', accion='analizar')
│    ├─ Muestra resumen con validación cruzada (tabla comparativa)            │
│    ├─ Tabla de detalles (ExtractDetailsTable)                               │
│    │    ├─ Filtros: Todos / A Cargar / Duplicados / Candidatos              │
│    │    └─ Edición solo para candidatos (errores de lectura)                │
│    └─ Botón "Confirmar y Cargar" → apiService.conciliacion.cargarExtracto() │
│         └─ Para archivos locales: procesarLocal('extractos', accion='cargar')
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Router: archivos.py                                                        │
│    ├─ POST /analizar → ProcesadorArchivosService.analizar_extracto()        │
│    ├─ POST /cargar → (no usado directo para extractos)                      │
│    ├─ POST /procesar-local → accion='analizar' o 'cargar'                   │
│    ├─ GET /listar-directorios?tipo=extractos                                │
│    ├─ GET /ver-pdf                                                          │
│    └─ GET /buscar-pagina-resumen                                            │
│                                                                             │
│  Service: cargar_extracto_bancario_service.py                               │
│    ├─ analizar_extracto() → Extrae resumen + movimientos + validación       │
│    └─ procesar_extracto() → Guarda conciliación + movimientos_extracto      │
│                                                                             │
│  Extractors: infrastructure/extractors/bancolombia/                         │
│    ├─ *_extracto.py → Extrae RESUMEN (saldos, entradas, salidas)            │
│    └─ *_extracto_movimientos.py → Extrae MOVIMIENTOS del PDF                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Archivos Clave

### Frontend

| Archivo | Descripción |
|---------|-------------|
| [UploadExtractoPage.tsx](frontend/src/pages/UploadExtractoPage.tsx) | Página principal de carga de extractos |
| [ExtractDetailsTable.tsx](frontend/src/components/organisms/ExtractDetailsTable.tsx) | Tabla de movimientos del extracto con filtros y estado |
| [EditExtractMovementModal.tsx](frontend/src/components/organisms/modals/EditExtractMovementModal.tsx) | Modal para editar movimientos (solo errores de lectura) |
| [files.service.ts](frontend/src/services/files.service.ts) | Cliente API: `procesarLocal()`, `buscarPaginaResumen()` |

### Backend

| Archivo | Descripción |
|---------|-------------|
| [archivos.py](Backend/src/infrastructure/api/routers/archivos.py) | Router con endpoints de archivos |
| [cargar_extracto_bancario_service.py](Backend/src/application/services/cargar_extracto_bancario_service.py) | Servicio de aplicación principal |
| [procesador_archivos_service.py](Backend/src/application/services/procesador_archivos_service.py) | Facade que delega a CargarExtractoBancarioService |
| [conciliacion_repository.py](Backend/src/domain/ports/conciliacion_repository.py) | Puerto para guardar conciliación mensual |
| [movimiento_extracto_repository.py](Backend/src/domain/ports/movimiento_extracto_repository.py) | Puerto para movimientos del extracto |

### Extractores (Parsers de PDF)

| Archivo | Tipo | Función |
|---------|------|---------|
| [ahorros_extracto.py](Backend/src/infrastructure/extractors/bancolombia/ahorros_extracto.py) | RESUMEN | Extrae saldos del extracto de ahorros |
| [fondorenta_extracto.py](Backend/src/infrastructure/extractors/bancolombia/fondorenta_extracto.py) | RESUMEN | Extrae saldos + rendimientos + retenciones |
| [mastercard_pesos_extracto.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_pesos_extracto.py) | RESUMEN | Extracto MasterCard formato nuevo (>= Sep 2025) |
| [mastercard_pesos_extracto_anterior.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_pesos_extracto_anterior.py) | RESUMEN | Extracto MasterCard formato legacy (< Sep 2025) |
| [mastercard_usd_extracto.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_usd_extracto.py) | RESUMEN | Extracto MasterCard USD |
| [fondorenta_extracto_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/fondorenta_extracto_movimientos.py) | MOVIMIENTOS | Extrae líneas de movimientos FondoRenta |
| [mastercard_pesos_extracto_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_pesos_extracto_movimientos.py) | MOVIMIENTOS | Extrae compras MasterCard Pesos |
| [mastercard_usd_extracto_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_usd_extracto_movimientos.py) | MOVIMIENTOS | Extrae compras MasterCard USD |

---

## Flujo Detallado

### 1. Selección de Cuenta

```typescript
// UploadExtractoPage.tsx - Usa SelectorCuenta con soloPermiteCarga=true
<SelectorCuenta
    value={cuentaId?.toString() ?? ''}
    onChange={(val) => {
        setCuentaId(Number(val))
        const cuenta = cuentas.find(c => c.id === id)
        if (cuenta) setTipoCuenta(cuenta.nombre) // "FondoRenta", "MasterCardPesos", etc.
    }}
    soloPermiteCarga={true}
/>
```

### 2. Análisis del PDF

```typescript
// Endpoint utilizado según origen del archivo:

// A) Archivo subido desde PC:
POST /api/archivos/analizar
{ file: File, tipo_cuenta: string, cuenta_id: number }

// B) Archivo del servidor:
POST /api/archivos/procesar-local
{ filename, tipo: 'extractos', tipo_cuenta, cuenta_id, accion: 'analizar' }
```

**Respuesta del análisis:**

```typescript
interface ResumenExtracto {
    // Cifras del encabezado del PDF
    saldo_anterior: number
    entradas: number
    salidas: number
    saldo_final: number
    rendimientos?: number      // Solo FondoRenta
    retenciones?: number       // Solo FondoRenta

    // Periodo
    year: number
    month: number
    periodo_texto: string      // "2025-12"

    // Conteo de movimientos
    total_leidos: number
    total_duplicados: number
    total_nuevos: number

    // Lista de movimientos parseados
    movimientos: ExtractDetailRow[]

    // Validación cruzada (encabezado vs suma de movimientos)
    validacion_cruzada: {
        es_valido: boolean
        diferencia_entradas: number
        diferencia_salidas: number
        diferencia_rendimientos: number
        diferencia_retenciones: number
        movimientos_entradas: number
        movimientos_salidas: number
        movimientos_rendimientos: number
        movimientos_retenciones: number
    }
}
```

### 3. Validación Cruzada

El sistema compara las cifras del **encabezado** del PDF con la **suma de movimientos** parseados:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Concepto      │ Extracto (PDF) │ Mov (PDF) │ Diferencia            │
├─────────────────────────────────────────────────────────────────────┤
│ Saldo Inicial │ $1,000,000     │ -         │ -                     │
│ Entradas      │ $500,000       │ $500,000  │ $0 ✓                  │
│ Salidas       │ $200,000       │ $195,000  │ $5,000 ⚠️             │
│ Saldo Final   │ $1,300,000     │ -         │ -                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Estados posibles:**

| Diferencia | Significado | Acción |
|------------|-------------|--------|
| = 0 | Todo cuadra | Carga habilitada |
| > 0 | Faltan movimientos | Revisar carga de movimientos pendientes |
| < 0 | Error de lectura | Verificar detalles, buscar duplicados |

### 4. Detección de Candidatos

Cuando hay descuadre, el sistema identifica "candidatos": movimientos cuyo valor absoluto coincide con la diferencia.

```typescript
// ExtractDetailsTable.tsx líneas 53-89
const TOLERANCIA_CANDIDATO = 100

// Es candidato si |valor| ≈ |diferencia| ± tolerancia
const esCandidato = diffValues.some(diff =>
    Math.abs(valorAbs - diff) < TOLERANCIA_CANDIDATO
)
```

Los candidatos se marcan con icono ámbar y pueden editarse (para corregir errores de OCR).

### 5. Edición de Movimientos (Solo Candidatos)

```typescript
// Solo se habilita edición para registros marcados como candidato
const puedeEditar = row.es_candidato && onEdit

// Al guardar, se recalculan los totales localmente
const handleSaveMovement = (updatedRecord: ExtractDetailRow) => {
    const newMovimientos = resumen.movimientos.map((m, idx) =>
        idx === editingMovement.index ? updatedRecord : m
    )
    // Recalcular validación cruzada con nuevos valores
    const { entradas, salidas, ... } = calculateTotals(newMovimientos)
    setResumen(prev => ({ ...prev, movimientos: newMovimientos, validacion_cruzada: {...} }))
}
```

### 6. Carga Definitiva

```typescript
// Envía los movimientos confirmados (posiblemente editados)
POST /api/archivos/procesar-local
{
    filename,
    tipo: 'extractos',
    tipo_cuenta,
    cuenta_id,
    year,
    month,
    accion: 'cargar',
    movimientos_json: JSON.stringify(movimientosConfirmados)
}

// Respuesta
{
    id_conciliacion: number,
    periodo: "2025-Diciembre",
    stats: {
        leidos: 50,
        nuevos: 45,
        duplicados: 5,
        errores: 0
    }
}
```

---

## Modelo de Datos

### Tabla `conciliacion`

Almacena el resumen mensual del extracto:

```sql
CREATE TABLE conciliacion (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    fecha_corte DATE,
    extracto_saldo_anterior NUMERIC(16,2),
    extracto_entradas NUMERIC(16,2),
    extracto_salidas NUMERIC(16,2),
    extracto_saldo_final NUMERIC(16,2),
    sistema_entradas NUMERIC(16,2),    -- Calculado desde movimientos del sistema
    sistema_salidas NUMERIC(16,2),
    sistema_saldo_final NUMERIC(16,2),
    diferencia_saldo NUMERIC(16,2),
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    datos_extra JSONB
);
```

### Tabla `movimientos_extracto`

Almacena cada línea del extracto:

```sql
CREATE TABLE movimientos_extracto (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    fecha DATE NOT NULL,
    descripcion TEXT,
    referencia VARCHAR(50),
    valor NUMERIC(16,2) NOT NULL,      -- Valor en COP (0 si USD)
    usd NUMERIC(16,2),                  -- Valor en USD
    trm NUMERIC(16,6),                  -- TRM aplicada
    numero_linea INTEGER,
    raw_text TEXT                       -- Línea original del PDF
);
```

---

## Manejo de Cuentas USD

Para cuentas en dólares (ej: MasterCard USD):

```python
# Backend - cargar_extracto_bancario_service.py líneas 182-186
if raw.get('usd') is not None and raw.get('moneda') == 'USD':
    val = Decimal(str(raw['usd']))  # Usar campo USD
else:
    val = Decimal(str(raw['valor']))  # Usar campo valor (COP)

# Detección de duplicados para USD
usd_val = raw.get('usd') if raw.get('moneda') == 'USD' else None
check_val = 0 if raw.get('moneda') == 'USD' else raw['valor']
existe = repo.existe_movimiento(..., valor=check_val, usd=usd_val)
```

```typescript
// Frontend - UploadExtractoPage.tsx línea 791
const esUSD = tipoCuenta.includes('USD') || tipoCuenta.includes('Dolares')

// ExtractDetailsTable.tsx línea 230
const val = esUSD ? Number(row.usd ?? 0) : Number(row.valor)
const formatter = esUSD
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })
```

---

## Tipos de Cuenta Soportados

| Tipo | cuenta_id | Extractor Resumen | Extractor Movimientos |
|------|-----------|-------------------|----------------------|
| Ahorros | 1 | `ahorros_extracto` | `ahorros_extracto_movimientos` |
| FondoRenta | 3 | `fondorenta_extracto` | `fondorenta_extracto_movimientos` |
| MasterCard Pesos | 6 | `mastercard_pesos_extracto` | `mastercard_pesos_extracto_movimientos` |
| MasterCard USD | 7 | `mastercard_usd_extracto` | `mastercard_usd_extracto_movimientos` |

**Nota:** Para MasterCard, el sistema detecta automáticamente si usar el formato "anterior" (PDFs antes de Sep 2025) basándose en el nombre del archivo:

```python
periodo = self._extraer_periodo_nombre_archivo(filename)
usar_anterior = (periodo and (periodo[0] < 2025 or (periodo[0] == 2025 and periodo[1] <= 8)))
```

---

## Configuración Requerida

### Variables de Entorno (.env)

```bash
DIRECTORIO_EXTRACTOS=path/to/extractos   # Para listar archivos del servidor
```

### Tabla cuenta_extractor

Define qué módulo usar para cada cuenta:

```sql
INSERT INTO cuenta_extractor (cuenta_id, modulo_extractor, tipo) VALUES
(3, 'fondorenta_extracto', 'RESUMEN'),
(3, 'fondorenta_extracto_movimientos', 'MOVIMIENTOS'),
(6, 'mastercard_pesos_extracto', 'RESUMEN'),
(6, 'mastercard_pesos_extracto_movimientos', 'MOVIMIENTOS');
```

---

## Guía de Modificaciones

### Agregar Soporte para Nuevo Banco/Cuenta

1. **Crear extractor de RESUMEN** en `Backend/src/infrastructure/extractors/bancolombia/`
   ```python
   # nuevo_banco_extracto.py
   def extraer_resumen(file_obj) -> Dict:
       """Retorna: saldo_anterior, entradas, salidas, saldo_final, year, month"""
   ```

2. **Crear extractor de MOVIMIENTOS**
   ```python
   # nuevo_banco_extracto_movimientos.py
   def extraer_movimientos(file_obj) -> List[Dict]:
       """Retorna lista de: fecha, descripcion, referencia, valor, moneda"""
   ```

3. **Registrar en BD**:
   ```sql
   INSERT INTO cuenta_extractor (cuenta_id, modulo_extractor, tipo) VALUES
   (N, 'nuevo_banco_extracto', 'RESUMEN'),
   (N, 'nuevo_banco_extracto_movimientos', 'MOVIMIENTOS');
   ```

### Modificar Lógica de Clasificación (Entradas/Salidas)

Archivo: [cargar_extracto_bancario_service.py](Backend/src/application/services/cargar_extracto_bancario_service.py)

- Líneas 188-208: Clasificación por tipo de cuenta
- FondoRenta tiene lógica especial para RENDIMIENTOS y RETENCIONES

### Modificar UI del Panel de Validación

Archivo: [UploadExtractoPage.tsx](frontend/src/pages/UploadExtractoPage.tsx)

- Líneas 470-777: Panel de validación cruzada (tabla comparativa)
- Líneas 680-737: Banners de estado (cuadra/faltan/error)

### Modificar Detección de Candidatos

Archivo: [ExtractDetailsTable.tsx](frontend/src/components/organisms/ExtractDetailsTable.tsx)

- Línea 42: `TOLERANCIA_CANDIDATO = 100` (tolerancia en pesos)
- Líneas 53-89: Lógica de marcado de candidatos

### Agregar Nuevas Columnas a movimientos_extracto

1. Crear migración SQL en `Sql/`
2. Actualizar modelo `MovimientoExtracto` en `Backend/src/domain/models/`
3. Actualizar repositorio en `Backend/src/infrastructure/database/`
4. Actualizar extractor para extraer el nuevo campo
5. Actualizar frontend `ExtractDetailRow` interface

---

## Flujo de Rendimientos (Solo FondoRenta)

El FondoRenta tiene tratamiento especial porque incluye:
- **Rendimientos**: Ganancias generadas (se suman como entrada especial)
- **Retenciones**: Impuestos descontados (se restan como salida especial)

```python
# cargar_extracto_bancario_service.py líneas 143-167
# Inyecta movimiento sintético de rendimientos al final del mes
if tipo_cuenta == 'FondoRenta' and datos.get('rendimientos'):
    mov_rend = {
        'fecha': date(year, month, last_day),
        'descripcion': 'RENDIMIENTOS',
        'referencia': 'AUTOMATICO',
        'valor': rend_val,
    }
    movs.append(mov_rend)
```

---

## Estados del Flujo

```
┌──────────────┐    Analizar     ┌──────────────┐    Confirmar    ┌──────────────┐
│   INICIAL    │ ──────────────► │   ANALIZADO  │ ──────────────► │   CARGADO    │
│              │                 │              │                 │              │
│ - Sin datos  │                 │ - Resumen    │                 │ - Guardado   │
│ - Sin archivo│                 │ - Validación │                 │ - Modal OK   │
│              │                 │ - Detalles   │                 │              │
└──────────────┘                 └──────────────┘                 └──────────────┘
        │                               │                                │
        │  Reiniciar                    │  Error                         │  Reiniciar
        ▼                               ▼                                ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              REINICIAR (resetState)                            │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pendientes / Mejoras Futuras

1. **Consulta automática de TRM** para cuentas USD (API Banco de la República)
2. **Detección de errores de OCR** más sofisticada
3. **Comparación con movimientos del sistema** (columnas "Cargados" en la tabla)
4. **Ver PDF inline** con navegación a página de resumen

---

## Ejemplo de Flujo Completo

```
1. Usuario selecciona "FondoRenta" (cuenta_id=3)
2. Selecciona archivo "2025-12.pdf" desde servidor
3. Sistema ejecuta análisis automáticamente:
   - Extrae resumen: saldo_anterior=$10M, entradas=$500K, salidas=$200K
   - Extrae 15 movimientos del PDF
   - Suma movimientos: entradas=$495K, salidas=$200K
   - Detecta diferencia de $5K en entradas
4. Frontend muestra:
   - Banner ámbar: "Faltan movimientos por $5,000"
   - Botón "Ver Detalles" se expande automáticamente
   - 1 registro marcado como "candidato" (valor $5,000)
5. Usuario verifica candidato, detecta error de OCR en valor
6. Edita el registro: cambia $5,000 a $10,000
7. Sistema recalcula: ahora diferencia = $0
8. Banner verde: "Los movimientos coinciden con el extracto"
9. Usuario presiona "Confirmar y Cargar"
10. Sistema guarda:
    - 1 registro en tabla `conciliacion` (resumen mensual)
    - 15 registros en tabla `movimientos_extracto`
11. Modal de éxito muestra: "15 leídos, 15 nuevos, 0 duplicados"
```
