# Skill: Cargar Movimientos

> Documentación completa de la funcionalidad "Cargar Movimientos" del sistema de conciliación bancaria.

## Resumen

Esta funcionalidad permite cargar movimientos bancarios desde archivos PDF a la base de datos. Soporta análisis previo (previsualización), detección de duplicados, y actualización de descripciones.

---

## Arquitectura del Flujo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  UploadMovimientosPage.tsx                                                  │
│    ├─ Selección de cuenta (filtra permite_carga=true)                       │
│    ├─ Upload PDF o selección desde servidor                                 │
│    ├─ Botón "Analizar" → POST /api/archivos/analizar                        │
│    ├─ Previsualización con estadísticas                                     │
│    └─ Botón "Cargar" → POST /api/archivos/cargar                            │
│                                                                             │
│  files.service.ts                                                           │
│    ├─ cargar(file, tipo_cuenta, cuenta_id, actualizar_descripciones)        │
│    ├─ analizar(file, tipo_cuenta, cuenta_id)                                │
│    └─ listarDirectorios('movimientos')                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Router: archivos.py                                                        │
│    ├─ POST /analizar → CargarMovimientosService.analizar_archivo()          │
│    ├─ POST /cargar → CargarMovimientosService.procesar_archivo()            │
│    └─ GET /listar-directorios?tipo=movimientos                              │
│                                                                             │
│  Service: cargar_movimientos_service.py                                     │
│    ├─ Carga extractor según tipo_cuenta                                     │
│    ├─ Parsea movimientos del PDF                                            │
│    ├─ Valida duplicados/actualizables                                       │
│    └─ Guarda en BD vía MovimientoRepository                                 │
│                                                                             │
│  Extractors: infrastructure/extractors/bancolombia/                         │
│    ├─ ahorros_movimientos.py                                                │
│    ├─ fondorenta_movimientos.py                                             │
│    ├─ mastercard_pesos_extracto_movimientos.py                              │
│    └─ mastercard_usd_extracto_movimientos.py                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Archivos Clave

### Frontend

| Archivo | Descripción |
|---------|-------------|
| [UploadMovimientosPage.tsx](frontend/src/pages/UploadMovimientosPage.tsx) | Página principal de carga de movimientos |
| [files.service.ts](frontend/src/services/files.service.ts) | Cliente API para operaciones de archivos |
| [LoadResultSummary.tsx](frontend/src/components/molecules/LoadResultSummary.tsx) | Modal con resumen de resultados |

### Backend

| Archivo | Descripción |
|---------|-------------|
| [archivos.py](Backend/src/infrastructure/api/routers/archivos.py) | Router con endpoints de carga |
| [cargar_movimientos_service.py](Backend/src/application/services/cargar_movimientos_service.py) | Servicio de aplicación (orquestación) |
| [procesador_archivos_service.py](Backend/src/application/services/procesador_archivos_service.py) | Facade delegador (legacy) |
| [movimiento_repository.py](Backend/src/domain/ports/movimiento_repository.py) | Puerto del repositorio |
| [postgres_movimiento_repository.py](Backend/src/infrastructure/database/postgres_movimiento_repository.py) | Implementación PostgreSQL |

### Extractores (Parsers de PDF)

| Archivo | Tipo de Cuenta |
|---------|----------------|
| [ahorros_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/ahorros_movimientos.py) | Ahorros Bancolombia |
| [fondorenta_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/fondorenta_movimientos.py) | FondoRenta |
| [mastercard_pesos_extracto_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_pesos_extracto_movimientos.py) | MasterCard Pesos |
| [mastercard_usd_extracto_movimientos.py](Backend/src/infrastructure/extractors/bancolombia/mastercard_usd_extracto_movimientos.py) | MasterCard USD |
| [utils.py](Backend/src/infrastructure/extractors/utils.py) | Funciones de parseo (fecha, valor, período) |

---

## Flujo Detallado

### 1. Selección de Cuenta

```typescript
// UploadMovimientosPage.tsx líneas 54-59
useEffect(() => {
  apiService.cuentas.listar()
    .then(data => setCuentas(data.filter(c => c.permite_carga)))
}, [])
```

- Solo muestra cuentas con `permite_carga = true`
- Al seleccionar, se asigna automáticamente `tipoCuenta` (nombre de la cuenta)

### 2. Análisis Previo (Previsualización)

```typescript
// POST /api/archivos/analizar
{
  file: File,           // PDF a analizar
  tipo_cuenta: string,  // "Ahorros", "FondoRenta", etc.
  cuenta_id: number     // ID de la cuenta
}

// Respuesta
{
  estadisticas: {
    leidos: number,
    duplicados: number,
    nuevos: number,
    actualizables: number
  },
  movimientos: [{
    fecha: "YYYY-MM-DD",
    descripcion: string,
    referencia: string,
    valor: Decimal,
    moneda: "COP" | "USD",
    es_duplicado: boolean,
    es_actualizable: boolean,
    descripcion_actual: string | null
  }],
  periodo: "YYYY-MMM"
}
```

### 3. Lógica de Duplicados y Actualizables

```python
# cargar_movimientos_service.py

# DUPLICADO: Existe exactamente igual
es_duplicado = repo.existe_movimiento(
    fecha=fecha,
    valor=valor,          # 0 si es USD
    referencia=referencia,
    cuenta_id=cuenta_id,
    descripcion=descripcion,
    usd=usd_value         # valor si es USD
)

# ACTUALIZABLE: Existe con misma fecha+valor, pero descripción diferente
soft_match = repo.obtener_exacto(
    cuenta_id=cuenta_id,
    fecha=fecha,
    valor=valor,
    referencia=None,      # NO busca por referencia
    descripcion=None      # NO busca por descripción
)
es_actualizable = soft_match is not None and not es_duplicado
```

**Regla crítica:** La búsqueda SIEMPRE filtra por `cuenta_id`. Dos movimientos idénticos en cuentas diferentes NO son duplicados.

### 4. Carga Definitiva

```typescript
// POST /api/archivos/cargar
{
  file: File,
  tipo_cuenta: string,
  cuenta_id: number,
  actualizar_descripciones: boolean  // Si true, actualiza registros existentes
}

// Respuesta
{
  archivo: string,
  total_extraidos: number,
  nuevos_insertados: number,
  actualizados: number,
  duplicados: number,
  errores: number,
  detalle_errores: [{ fecha, descripcion, valor, error }],
  periodo: string,
  // Totales por moneda
  total_ingresos: Decimal,
  total_egresos: Decimal,
  total_ingresos_usd: Decimal,
  total_egresos_usd: Decimal,
  // Desglose por categoría
  ingresos_cargados: Decimal,
  egresos_cargados: Decimal,
  ingresos_duplicados: Decimal,
  egresos_duplicados: Decimal,
  // ... etc
}
```

---

## Extractores de PDF

### Estructura de un Extractor

```python
# ahorros_movimientos.py

def extraer_movimientos(file_obj) -> List[Dict]:
    """
    Extrae movimientos de un PDF de cuenta de ahorros.

    Returns:
        Lista de diccionarios con:
        - fecha: str ("27 dic 2025")
        - descripcion: str
        - referencia: str (opcional)
        - valor: str ("-$ 1.000,00")
        - moneda: str ("COP")
    """
    # 1. Leer PDF con pdfplumber o PyPDF2
    # 2. Aplicar regex para cada línea
    # 3. Retornar lista de movimientos crudos
```

### Formatos por Tipo de Cuenta

| Tipo | Formato de Línea |
|------|------------------|
| Ahorros | `27 dic 2025 Descripción del movimiento 1234567 -$ 1.000,00` |
| FondoRenta | Similar a Ahorros |
| MasterCard | `R06441 26/12/2025 DROGUERIA PASTEUR $ 61.856,00` |

### Funciones de Parseo (utils.py)

```python
parsear_fecha("27 dic 2025") → "2025-12-27"
parsear_valor("-$ 1.000,00") → Decimal(-1000.00)
extraer_periodo_de_movimientos(movs) → "2025-DIC"
```

---

## Manejo de USD

Los movimientos en dólares tienen tratamiento especial:

```python
# Almacenamiento en BD
if es_usd:
    valor = 0               # Siempre 0 para USD
    usd = valor_real        # Valor en dólares
else:
    valor = valor_real      # Valor en pesos
    usd = None

# Búsqueda de duplicados
valor_para_check = 0 if es_usd else raw['valor']
usd_val = raw['valor'] if es_usd else None
```

---

## Modelo de Dominio

```python
@dataclass
class Movimiento:
    moneda_id: int          # 1=COP por defecto
    cuenta_id: int          # ID de cuenta bancaria
    fecha: date             # Fecha del movimiento
    valor: Decimal          # Valor en COP (0 si USD)
    descripcion: str        # Descripción del movimiento

    # Opcionales
    id: Optional[int] = None
    tercero_id: Optional[int] = None
    referencia: str = ""
    usd: Optional[Decimal] = None
    trm: Optional[Decimal] = None
    created_at: Optional[datetime] = None
```

---

## Tipos de Cuenta Soportados

| Tipo | cuenta_id | Extractor |
|------|-----------|-----------|
| Ahorros | 1 | `ahorros_movimientos` |
| FondoRenta | 3 | `fondorenta_movimientos` |
| MasterCard Pesos | 6 | `mastercard_pesos_extracto_movimientos` |
| MasterCard USD | 7 | `mastercard_usd_extracto_movimientos` |

La tabla `cuenta_extractor` en BD mapea cada cuenta a su módulo extractor. Si no existe configuración, usa defaults hardcoded.

---

## Configuración Requerida

### Variables de Entorno (.env)

```bash
DIRECTORIO_MOVIMIENTOS=path/to/movimientos  # Para listado desde servidor
DIRECTORIO_EXTRACTOS=path/to/extractos
```

### Tabla cuenta

```sql
-- Campo permite_carga controla qué cuentas aparecen en el dropdown
UPDATE cuenta SET permite_carga = true WHERE id IN (1, 3, 6, 7);
```

---

## Manejo de Errores

### Frontend

```typescript
try {
    const result = await apiService.archivos.cargar(...)
    setResultado(result)
} catch (err) {
    setError(err.message || "Error al cargar movimientos")
}
```

### Backend

```python
# Router: Valida extensión PDF
if not file.filename.lower().endswith('.pdf'):
    raise HTTPException(400, "Solo se permiten archivos PDF")

# Servicio: Captura errores por movimiento
for raw in raw_movs:
    try:
        repo.guardar(nuevo_mov)
    except Exception as e:
        errores += 1
        detalle_errores.append({...})
```

---

## Guía de Modificaciones

### Agregar Nuevo Tipo de Cuenta

1. **Crear extractor** en `Backend/src/infrastructure/extractors/bancolombia/`
   ```python
   # nuevo_tipo_movimientos.py
   def extraer_movimientos(file_obj) -> List[Dict]:
       # Implementar parseo del PDF
   ```

2. **Registrar en BD** tabla `cuenta_extractor`:
   ```sql
   INSERT INTO cuenta_extractor (cuenta_id, modulo_extractor, tipo)
   VALUES (N, 'nuevo_tipo_movimientos', 'movimientos');
   ```

3. **Configurar cuenta**:
   ```sql
   UPDATE cuenta SET permite_carga = true WHERE id = N;
   ```

### Modificar Lógica de Duplicados

Archivo: [cargar_movimientos_service.py](Backend/src/application/services/cargar_movimientos_service.py)

- Método `analizar_archivo()`: líneas 104-128
- Método `procesar_archivo()`: líneas 150-200

### Modificar UI de Carga

Archivo: [UploadMovimientosPage.tsx](frontend/src/pages/UploadMovimientosPage.tsx)

- Formulario: líneas 246-320
- Previsualización: líneas 366-460
- Estadísticas: líneas 324-363

### Cambiar Formato de Parseo de Fechas/Valores

Archivo: [utils.py](Backend/src/infrastructure/extractors/utils.py)

- `parsear_fecha()`: Convierte strings a ISO
- `parsear_valor()`: Convierte strings a Decimal

---

## Notas Importantes

1. **Filtro por cuenta obligatorio**: Todas las búsquedas de duplicados filtran por `cuenta_id`

2. **Actualización de descripciones**: Solo se activa si el checkbox está marcado Y existe un registro con mismo `fecha + valor`

3. **Período**: Se extrae del nombre del archivo (`2025-01.pdf`) o del primer movimiento

4. **MasterCard especial**: Los extractores de MasterCard detectan y separan las secciones de Pesos y Dólares en el mismo PDF

5. **Transacciones**: Cada INSERT es individual. Si falla uno, los demás continúan y se reportan los errores

6. **Módulos antiguos**: Existen versiones `*_extracto_anterior_*` para formatos de PDFs legacy

---

## Ejemplo de Flujo Completo

```
1. Usuario selecciona "Ahorros Bancolombia" (cuenta_id=1)
2. Sube archivo "2025-12.pdf"
3. Clic en "Analizar"
4. Backend extrae 50 movimientos del PDF
5. Detecta: 45 nuevos, 3 duplicados, 2 actualizables
6. Frontend muestra previsualización con colores:
   - Verde: nuevos
   - Naranja: duplicados
   - Azul: actualizables
7. Usuario marca "Actualizar descripciones"
8. Clic en "Cargar 47 Registros"
9. Backend inserta 45 nuevos + actualiza 2 existentes
10. Modal muestra resumen: "45 insertados, 2 actualizados, 3 duplicados"
```
