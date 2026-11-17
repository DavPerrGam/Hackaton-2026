-- =====================================================================
-- IDEAPRO Intelligence AI · Etapas 4 y 11 del protocolo
-- ---------------------------------------------------------------------
-- Ejecutar DESPUÉS de migration_nexus_ai.sql.
-- Es incremental e idempotente: no borra datos ni recrea tablas.
--
-- Qué agrega y por qué:
--   1. diagnosticos.tags: etapa 4, tags estandarizados. Son la llave de
--      AGRUPACIÓN del ecosistema (buscar "todas las organizaciones de
--      gestión documental que ya venden a alcaldías"), algo que la
--      clasificación por sí sola no permite porque es porcentual.
--   2. diagnosticos.organizaciones_similares: etapa 11, relaciones
--      empresariales calculadas contra el resto del ecosistema, con el
--      porcentaje de similitud y la lectura de alianza. Se persiste
--      como fotografía del momento del diagnóstico: el ecosistema
--      cambia, y el reporte entregado debe seguir siendo auditable.
--   3. Índice GIN sobre tags para las consultas por etiqueta del panel
--      administrativo.
--
-- Nota de compatibilidad: el backend degrada de forma controlada si
-- esta migración NO se ha aplicado (ver COLUMNAS_NEXUS en
-- agentService.js). Sin ella, tags y relaciones se recalculan en cada
-- lectura del diagnóstico en lugar de leerse de la base.
-- =====================================================================

ALTER TABLE diagnosticos
  -- Etapa 4: [{ tag, tipo, origen }]. `tipo` distingue si la etiqueta
  -- viene de la clasificación, del léxico de capacidades, del mapa de
  -- entidades, de la necesidad pública o de la ficha.
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]',

  -- Etapa 11: { organizaciones: [...], evaluadas: int, nota: text }.
  -- Cada organización incluye similitud, categorías y tags en común,
  -- tipo de relación (complementaria / competencia_directa /
  -- oferta_integrada), posible alianza y oportunidad conjunta.
  ADD COLUMN IF NOT EXISTS organizaciones_similares JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN diagnosticos.tags IS
  'Etapa 4: tags estandarizados de vocabulario controlado. Llave de agrupación de organizaciones afines dentro del ecosistema IDEAPRO.';
COMMENT ON COLUMN diagnosticos.organizaciones_similares IS
  'Etapa 11: relaciones empresariales calculadas contra el ecosistema registrado, con porcentaje de similitud y lectura de alianza.';

-- Consulta real del panel: "organizaciones con el tag X". jsonb_path_ops
-- es el operador adecuado porque solo se consulta por contención.
CREATE INDEX IF NOT EXISTS idx_diagnosticos_tags
  ON diagnosticos USING GIN (tags jsonb_path_ops);
