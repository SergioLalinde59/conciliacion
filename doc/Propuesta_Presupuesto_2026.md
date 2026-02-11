# Propuesta: Sistema de Presupuesto 2026

## Filosofía General

El presupuesto se construye **de abajo hacia arriba** (bottom-up) usando los datos reales de 2025, con la misma granularidad que ya tiene la clasificación: **Centro de Costo → Concepto → Tercero**. Esto permite reutilizar toda la infraestructura de reportes existente.

---

## 1. Modelo de Datos Propuesto

```sql
presupuestos (tabla maestra)
├── id (PK, SERIAL)
├── año (INT)                    -- 2026
├── nombre (VARCHAR)             -- "Presupuesto 2026"
├── estado (VARCHAR)             -- borrador | activo | cerrado
├── created_at (TIMESTAMP)
└── notas (TEXT)

presupuesto_detalle (líneas de presupuesto)
├── id (PK, SERIAL)
├── presupuesto_id (FK → presupuestos)
├── centro_costo_id (FK → centro_costos)
├── concepto_id (FK → conceptos, nullable)
├── tercero_id (FK → terceros, nullable)
├── mes (INT)                    -- 1-12
├── monto_presupuestado (DECIMAL)
├── monto_ajustado (DECIMAL, nullable)  -- para revisiones mid-year
├── tipo (VARCHAR)               -- fijo | variable | estacional
├── notas (TEXT, nullable)
└── created_at (TIMESTAMP)
```

**Por qué esta estructura:**
- **presupuestos** permite tener múltiples versiones (borrador, aprobado, revisiones)
- **presupuesto_detalle** a nivel mes permite capturar estacionalidad (diciembre gasto más, enero menos)
- La granularidad Centro Costo + Concepto + Tercero coincide exactamente con `movimientos_detalle`
- `concepto_id` y `tercero_id` son nullable para permitir presupuestar a nivel agregado (solo por centro de costo si se prefiere)

---

## 2. Generación del Presupuesto Base (desde 2025)

El query para generar el presupuesto base:

```sql
-- Extraer gastos reales 2025, agrupados por mes y clasificación
SELECT
    md.centro_costo_id,
    md.ConceptoID as concepto_id,
    md.TerceroID as tercero_id,
    EXTRACT(MONTH FROM m.Fecha) as mes,
    SUM(CASE WHEN md.Valor < 0 THEN ABS(md.Valor) ELSE 0 END) as egresos,
    SUM(CASE WHEN md.Valor > 0 THEN md.Valor ELSE 0 END) as ingresos,
    COUNT(*) as num_transacciones
FROM movimientos_encabezado m
JOIN movimientos_detalle md ON m.Id = md.movimiento_id
WHERE m.Fecha >= '2025-01-01' AND m.Fecha <= '2025-12-31'
  AND md.centro_costo_id IS NOT NULL
GROUP BY md.centro_costo_id, md.ConceptoID, md.TerceroID,
         EXTRACT(MONTH FROM m.Fecha)
ORDER BY md.centro_costo_id, md.ConceptoID, mes;
```

Esto genera las líneas base. Luego el usuario puede aplicar **ajustes**:
- **% inflación global** (ej: +8% sobre todo)
- **% por centro de costo** (ej: Salud +12%, Transporte +5%)
- **Monto fijo** por línea específica (ej: arriendo sube de 2.5M a 2.8M)
- **Eliminar líneas** no recurrentes (ej: compra única de un electrodoméstico)

---

## 3. Niveles de Granularidad

El usuario puede presupuestar en **3 niveles**, según necesite:

| Nivel | Ejemplo | Cuándo usar |
|-------|---------|-------------|
| **Centro de Costo** | Hogar: $5M/mes | Para categorías donde no interesa el detalle |
| **Centro Costo + Concepto** | Hogar > Servicios: $800K/mes | Para control por subcategoría |
| **Centro Costo + Concepto + Tercero** | Hogar > Servicios > EPM: $200K/mes | Para gastos fijos con proveedor conocido |

Cuando se compara presupuesto vs real, se hace **roll-up**: si hay presupuesto a nivel Tercero, se suma para comparar a nivel Concepto; si hay presupuesto a nivel Concepto, se suma para Centro de Costo.

---

## 4. Reportes de Seguimiento (Budget vs Actual)

Tres vistas principales:

### A) Resumen Mensual

```
                  Ene-26    Feb-26    Mar-26    ...    Total
Presupuesto:     $12.5M    $11.8M    $13.2M           $152M
Real:            $11.9M    $12.4M    (pendiente)
Variación:       -$600K    +$600K
Variación %:      -4.8%     +5.1%
```

### B) Desglose por Centro de Costo

```
Centro Costo     Presup.    Real      Var.      Var %    Semáforo
─────────────────────────────────────────────────────────────────
Hogar            $5.0M     $4.8M     -$200K    -4.0%    Verde
Transporte       $2.0M     $2.5M     +$500K   +25.0%    Rojo
Salud            $1.5M     $1.4M     -$100K    -6.7%    Verde
Alimentación     $3.0M     $3.1M     +$100K    +3.3%    Amarillo
```

### C) Drill-down (reutiliza patrón existente de reportes)

- Centro Costo → Concepto → Tercero → Movimientos
- Cada nivel muestra: Presupuestado | Real | Variación | %

### Semáforo

- **Verde**: variación <= 5%
- **Amarillo**: variación 5-15%
- **Rojo**: variación > 15%

---

## 5. Mejores Prácticas

### A) Diseño del Presupuesto

- **Separar fijos de variables**: Arriendo, seguros = fijo mensual. Alimentación, entretenimiento = variable
- **Usar promedios móviles** para variables: promedio de los últimos 3-6 meses de 2025, no el año completo (captura tendencia reciente)
- **Reserva para imprevistos**: 5-10% adicional como colchón
- **No presupuestar traslados entre cuentas**: Excluir centros de costo tipo "Traslados" (ya existe este filtro en el sistema)

### B) Periodicidad de Revisión

- **Mensual**: Comparar presupuesto vs real del mes anterior
- **Trimestral**: Ajustar proyección del resto del año (campo `monto_ajustado`)
- **Solo 1 presupuesto activo** por año, pero poder crear borradores de revisión

### C) Integración con el Sistema Actual

- El presupuesto depende de que **toda transacción esté clasificada** (tercero + CC + concepto)
- Los reportes existentes (Egresos por CC, por Tercero) se enriquecen con la columna "Presupuestado"
- El Dashboard puede mostrar un widget de "% de presupuesto consumido" del mes actual

### D) Manejo de USD

- Presupuestar en la moneda de la cuenta (COP o USD)
- Para consolidar, usar TRM del momento de comparación
- Consistente con el manejo actual en reportes

### E) Tratamiento de Ingresos

- Opcionalmente presupuestar ingresos también (salario, rendimientos)
- Permite calcular **ahorro proyectado** = ingresos presupuestados - egresos presupuestados

---

## 6. Flujo de Usuario Propuesto

```
1. Crear Presupuesto 2026
   └─ Sistema genera base automática desde datos 2025
      └─ Query agrupa por CC/Concepto/Tercero/Mes

2. Revisar y Ajustar
   ├─ Vista tipo tabla editable (similar a Excel)
   ├─ Aplicar % inflación global o por CC
   ├─ Ajustar líneas individuales
   └─ Eliminar gastos no recurrentes

3. Activar Presupuesto
   └─ Estado: borrador → activo

4. Seguimiento Mensual
   ├─ Dashboard: widget de progreso
   ├─ Reporte: Budget vs Actual con drill-down
   └─ Alertas: semáforo rojo cuando una categoría excede 15%
```

---

## 7. Alcance Recomendado de Implementación

| Fase | Qué incluye | Complejidad |
|------|-------------|-------------|
| **Fase 1** | Tabla `presupuestos` + `presupuesto_detalle`, generación automática desde 2025, CRUD básico | Media |
| **Fase 2** | Reporte Budget vs Actual con drill-down, semáforos, widget dashboard | Media-Alta |
| **Fase 3** | Ajustes por inflación, revisiones mid-year, tabla editable tipo Excel | Alta |

Recomendación: empezar por **Fase 1 + Fase 2** juntas, ya que el valor real está en la comparación presupuesto vs real.