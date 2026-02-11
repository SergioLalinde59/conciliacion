-- Migración: Cache local de TRM (Tasa Representativa del Mercado)
-- Fuente: datos.gov.co (Socrata API)

CREATE TABLE IF NOT EXISTS trm_cache (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    valor NUMERIC(16, 6) NOT NULL,
    fuente VARCHAR(100) DEFAULT 'datos.gov.co',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trm_cache_fecha ON trm_cache(fecha);
