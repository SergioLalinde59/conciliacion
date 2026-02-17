-- Migración: Agregar keywords JSONB y prioridad a tipos_gasto
-- Parejas {centro_costo, concepto} para auto-clasificar tipos de gasto
-- null = wildcard (cualquier valor), ambos non-null = AND
-- Datos semilla basados en patrones reales del año 2025

ALTER TABLE tipos_gasto ADD COLUMN keywords JSONB DEFAULT '[]';
ALTER TABLE tipos_gasto ADD COLUMN prioridad INT DEFAULT 99;

-- Salarial (prioridad 1)
UPDATE tipos_gasto SET prioridad = 1, keywords = '[
  {"centro_costo":null,"concepto":"salario"},
  {"centro_costo":null,"concepto":"sueldo"},
  {"centro_costo":null,"concepto":"nómina"},
  {"centro_costo":null,"concepto":"nomina"},
  {"centro_costo":null,"concepto":"seguridad social"}
]' WHERE tipo = 'Salarial';

-- Fijo (prioridad 2) — suscripciones, seguros, telecom, servicios, bancarios
UPDATE tipos_gasto SET prioridad = 2, keywords = '[
  {"centro_costo":null,"concepto":"administración"},
  {"centro_costo":null,"concepto":"administracion"},
  {"centro_costo":null,"concepto":"prepagada"},
  {"centro_costo":null,"concepto":"sura"},
  {"centro_costo":null,"concepto":"seguro"},
  {"centro_costo":null,"concepto":"netflix"},
  {"centro_costo":null,"concepto":"spotify"},
  {"centro_costo":null,"concepto":"youtube"},
  {"centro_costo":null,"concepto":"prime"},
  {"centro_costo":null,"concepto":"adobe"},
  {"centro_costo":null,"concepto":"coursera"},
  {"centro_costo":null,"concepto":"github"},
  {"centro_costo":null,"concepto":"openai"},
  {"centro_costo":null,"concepto":"gemini"},
  {"centro_costo":null,"concepto":"cuota de manejo"},
  {"centro_costo":null,"concepto":"cuota manejo"},
  {"centro_costo":null,"concepto":"tigo"},
  {"centro_costo":null,"concepto":"claro"},
  {"centro_costo":null,"concepto":"movistar"},
  {"centro_costo":null,"concepto":"celular e internet"},
  {"centro_costo":null,"concepto":"servicios públicos"},
  {"centro_costo":null,"concepto":"servicios publicos"},
  {"centro_costo":null,"concepto":"diezmo"},
  {"centro_costo":null,"concepto":"corpaul"},
  {"centro_costo":null,"concepto":"suscripci"},
  {"centro_costo":null,"concepto":"4xmil"},
  {"centro_costo":null,"concepto":"4x1000"},
  {"centro_costo":"suscripciones","concepto":null},
  {"centro_costo":"donaciones","concepto":null},
  {"centro_costo":"bancolombia","concepto":null}
]' WHERE tipo = 'Fijo';

-- Estacional (prioridad 3) — anuales: predial, soat, impuestos vehiculares, IVA
UPDATE tipos_gasto SET prioridad = 3, keywords = '[
  {"centro_costo":null,"concepto":"predial"},
  {"centro_costo":null,"concepto":"soat"},
  {"centro_costo":null,"concepto":"tecno mecánica"},
  {"centro_costo":null,"concepto":"tecno mecanica"},
  {"centro_costo":null,"concepto":"iva"},
  {"centro_costo":"carro","concepto":"impuesto"}
]' WHERE tipo = 'Estacional';

-- Sin keywords (se determinan por frecuencia)
UPDATE tipos_gasto SET prioridad = 4, keywords = '[]' WHERE tipo = 'No Repetitivo';
UPDATE tipos_gasto SET prioridad = 5, keywords = '[]' WHERE tipo = 'Variable';
