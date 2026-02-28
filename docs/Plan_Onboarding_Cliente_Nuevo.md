# Plan de Recoleccion de Datos - Onboarding Cliente Nuevo

## Contexto

Para poner en marcha el sistema de conciliacion para un cliente nuevo, se necesita recolectar datos maestros, configuracion y datos operativos iniciales. Este documento define que debe entregar el cliente, en que formato, y en que orden se procesa.

---

## Fase 1: Datos Maestros (antes de arrancar)

El cliente debe entregar **5 bloques de informacion** en archivos Excel (.xlsx) o CSV con las columnas indicadas.

---

### 1.1 Monedas

**Archivo**: `monedas.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| codigo_iso | texto(3) | Si | COP |
| nombre | texto | Si | Pesos Colombianos |

> Minimo: la moneda local. Si maneja cuentas en USD u otra divisa, incluirlas.

---

### 1.2 Cuentas Bancarias

**Archivo**: `cuentas.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| nombre | texto | Si | Ahorros Bancolombia |
| tipo | texto | Si | Cuenta Bancaria / Tarjeta de Credito / Efectivo / Inversiones |
| numero_cuenta | texto(9-16) | Si* | xxx-xxxxxx-xx |
| moneda | texto(3) | Si | COP |
| banco | texto | Si | Bancolombia |
| saldo_inicial | numero | Si | 230,450.00 |
| fecha_saldo_inicial | fecha | Si | 2025-01-01 |
| permite_carga_extracto | si/no | Si | Si |
| permite_conciliar | si/no | Si | Si |

> *numero_cuenta obligatorio para cuentas bancarias y tarjetas. No aplica para Efectivo.
> **El saldo inicial es critico** - es el punto de partida para la conciliacion.

**Tipos de cuenta disponibles**:
- **Efectivo**: Caja menor, manejo manual. Permite crear/editar/borrar movimientos.
- **Cuenta Bancaria**: Movimientos vienen del extracto. Solo se clasifican.
- **Tarjeta de Credito**: Igual que bancaria, movimientos del extracto.
- **Inversiones/Fondo Renta**: Fondos de inversion, CDTs.

---

### 1.3 Centros de Costo

**Archivo**: `centros_costo.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| nombre | texto(50) | Si | Vivienda |

> Son las categorias principales de agrupacion del gasto/ingreso del cliente.
> Ejemplos tipicos: Vivienda, Alimentacion, Transporte, Educacion, Salud, Impuestos, etc.
> Se recomienda incluir un centro de costo "Por Clasificar" para movimientos pendientes.
> Se recomienda incluir "Traslados" para movimientos entre cuentas propias.

---

### 1.4 Conceptos (Subcategorias)

**Archivo**: `conceptos.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| nombre | texto(100) | Si | Arriendo |
| centro_costo | texto | Si | Vivienda |

> Cada concepto pertenece a un centro de costo.
> Ejemplo: Centro "Vivienda" -> Conceptos: Arriendo, Servicios Publicos, Administracion, Internet
> Se recomienda incluir un concepto "Por Clasificar" en el centro de costo "Por Clasificar".

---

### 1.5 Terceros (Lista inicial)

**Archivo**: `terceros.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| nombre | texto(50) | Si | EPM |
| nombre_completo | texto(200) | No | Empresas Publicas de Medellin S.A. E.S.P. |
| direccion | texto(200) | No | Cra 58 #42-125 |
| ciudad | texto(100) | No | Medellin |
| telefono | texto(20) | No | 604-380-0000 |
| celular | texto(20) | No | 310-555-1234 |
| correo_electronico | texto(100) | No | contacto@epm.com.co |
| cuenta | texto(50) | No | 123-456789-00 |
| tipo_cuenta | texto(20) | No | Ahorros / Corriente |
| banco | texto(100) | No | Bancolombia |
| forma_pago | texto(30) | No | Consignacion / Transferencia / Cheque / Efectivo |
| descripciones_alternativas | texto | No | EPM Servicios;Empresas Publicas Medellin |

> Los terceros son las contrapartes: comercios, personas, entidades.
> La lista inicial debe incluir los mas frecuentes. Se iran agregando mas durante la operacion.
> Las descripciones alternativas ayudan al matching automatico (separar con ;).
> Los datos de contacto y bancarios son opcionales y se pueden completar despues.

---

## Fase 2: Configuracion (definida con el cliente)

Estos datos se configuran **en conjunto** con el cliente durante el onboarding.

---

### 2.1 Perspectivas (Vistas de filtrado)

**Preguntar al cliente**: "Como quiere ver sus finanzas segmentadas?"

| Dato | Descripcion | Ejemplo |
|------|-------------|---------|
| nombre | Nombre de la vista | Personal |
| tipo | incluir o excluir centros de costo | excluir |
| centros_costo | Lista de CC a incluir/excluir | Empresa, Traslados |
| es_defecto | Vista por defecto | Si |

> Minimo 1 perspectiva (la default). Tipicas: Personal, Empresa, Todo.

---

### 2.2 Valores "Pendiente"

Definir cuales registros representan "sin clasificar":
- Un tercero "Por identificar"
- Un centro de costo "Por Clasificar"
- Un concepto "Por Clasificar"

> Se crean automaticamente si el cliente incluye estos en sus catalogos.

---

### 2.3 Indicadores Economicos (para presupuesto)

**Archivo**: `indicadores.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| anio | numero | Si | 2026 |
| indicador | texto | Si | IPC Colombia |
| valor_porcentaje | numero | Si | 5.20 |
| notas | texto | No | Inflacion anual |

> Se usa para ajustar el presupuesto. Minimo: IPC del ano en curso.

---

## Fase 3: Datos Operativos (para arrancar)

---

### 3.1 Formato de Movimientos Diarios del Banco

**El cliente debe entregar periodicamente** (diario o semanal) un archivo con los movimientos de cada cuenta.

**Archivo**: `movimientos_[cuenta]_[fecha].xlsx` o PDF del banco

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| fecha | fecha | Si | 2026-01-15 |
| descripcion | texto | Si | PAGO PSE TIGO |
| referencia | texto | No | 10022150893 |
| valor | numero | Si | -47,610.00 (negativo=egreso) |
| valor_usd | numero | Solo USD | 12.99 |
| trm | numero | Solo USD | 3,652.89 |

> Si el cliente usa PDF bancario, se debe desarrollar un extractor especifico para su banco.
> El formato exacto del PDF depende del banco - el cliente debe entregar un PDF ejemplo.

---

### 3.2 Extracto Mensual (al inicio del mes siguiente)

**El cliente entrega el extracto bancario oficial** de cada cuenta al cierre del mes.

Datos necesarios del extracto:
| Dato | Ejemplo |
|------|---------|
| Cuenta | Ahorros Bancolombia |
| Mes/Ano | Enero 2026 |
| Saldo anterior | 5,230,450.00 |
| Total entradas | 8,500,000.00 |
| Total salidas | 7,200,000.00 |
| Saldo final | 6,530,450.00 |
| Movimientos detallados | (lista de transacciones) |

> El extracto se usa para: (1) cargar movimientos del extracto, (2) verificar saldos en la conciliacion.

---

### 3.3 Presupuesto (opcional al arranque)

**Opcion A - Desde historicos**: Cargar al menos 6-12 meses de movimientos clasificados y generar presupuesto automaticamente.

**Opcion B - Manual desde Excel**: `presupuesto.xlsx`

| Columna | Tipo | Obligatorio | Ejemplo |
|---------|------|-------------|---------|
| centro_costo | texto | Si | Vivienda |
| concepto | texto | Si | Arriendo |
| mes | numero(1-12) | Si | 1 |
| monto | numero | Si | 2,500,000 |
| tipo | texto | Si | fijo / variable |
| direccion | texto | Si | egreso / ingreso |

---

## Resumen: Checklist de Entregables del Cliente

### Obligatorios (Dia 1):
- [ ] `monedas.xlsx` - Monedas que maneja
- [ ] `cuentas.xlsx` - Cuentas bancarias **con saldos iniciales**
- [ ] `centros_costo.xlsx` - Categorias de gasto/ingreso
- [ ] `conceptos.xlsx` - Subcategorias por centro de costo
- [ ] `terceros.xlsx` - Lista inicial de terceros frecuentes
- [ ] PDF ejemplo de extracto de cada banco (para desarrollar extractor)

### Configuracion (Semana 1, con asesoria):
- [ ] Perspectivas definidas (como quiere ver los datos)
- [ ] Indicadores economicos del ano
- [ ] Reglas de clasificacion iniciales (se construyen juntos)

### Operativos (continuo):
- [ ] Movimientos diarios (archivo del banco o PDF)
- [ ] Extracto mensual oficial (al inicio del mes siguiente)
- [ ] Presupuesto (Excel manual o generado desde historicos)

---

## Orden de Carga en el Sistema

1. Crear monedas
2. Crear tipos de cuenta (seed del sistema)
3. Crear cuentas bancarias con saldos iniciales
4. Crear centros de costo
5. Crear conceptos
6. Crear terceros + descripciones
7. Configurar perspectivas
8. Configurar valores pendientes
9. Configurar matching (valores por defecto)
10. Desarrollar extractores PDF para los bancos del cliente
11. Cargar movimientos historicos (si hay)
12. Clasificar movimientos
13. Generar/cargar presupuesto
14. Iniciar operacion mensual: carga extractos -> matching -> conciliacion

---

## Verificacion Post-Carga

- `GET /api/catalogos` - Valida que todos los maestros esten cargados
- `GET /api/perspectivas` - Valida perspectivas configuradas
- `GET /api/cuentas` - Valida cuentas con tipos correctos
- Dashboard carga sin errores
- Cargar un extracto de prueba y verificar que el matching funcione