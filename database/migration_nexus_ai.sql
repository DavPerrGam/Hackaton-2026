-- =====================================================================
-- IDEAPRO Nexus AI · Migración del protocolo de 15 etapas
-- ---------------------------------------------------------------------
-- Ejecutar DESPUÉS de migration_ideapro_2026.sql.
-- Es incremental e idempotente: no borra datos ni recrea tablas.
--
-- Qué agrega y por qué:
--   1. empresas: los campos de identificación que exige la etapa 1 del
--      protocolo (tipo de organización, cargo del contacto, sitio web).
--   2. diagnosticos: las salidas de las etapas 2, 3, 4, 7, 10, 11, 12,
--      14 y 15, que antes no tenían dónde persistir. Van como JSONB
--      porque son documentos estructurados de solo lectura para el
--      frontend, no entidades relacionales consultables por separado.
--   3. Índices para las consultas reales del panel administrativo:
--      filtrar por estado de elegibilidad, por riesgo financiero y por
--      nivel numérico de madurez.
--
-- Nota de compatibilidad: el backend degrada de forma controlada si
-- esta migración NO se ha aplicado (ver esquemaNexusNoDisponible en
-- agentService.js). Aplicarla habilita la persistencia del reporte y
-- del plan de acción, sin la cual se recalculan en cada consulta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EMPRESAS · identificación (etapa 1)
-- ---------------------------------------------------------------------
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS tipo_organizacion TEXT
    CHECK (tipo_organizacion IS NULL OR tipo_organizacion IN (
      'empresa_privada','fundacion','universidad','cooperativa','asociacion',
      'consultora','empresa_tecnologica','organizacion_social','corporacion','otra'
    )),
  ADD COLUMN IF NOT EXISTS cargo_contacto TEXT,
  ADD COLUMN IF NOT EXISTS sitio_web TEXT;

COMMENT ON COLUMN empresas.tipo_organizacion IS
  'Clasificación A-J de la etapa 1 del protocolo Nexus. Define el marco jurídico de relacionamiento con el Estado.';
COMMENT ON COLUMN empresas.cargo_contacto IS
  'Cargo del contacto. Se usa para inferir facultades de representación en la evaluación jurídica (etapa 6).';

CREATE INDEX IF NOT EXISTS idx_empresas_tipo_organizacion
  ON empresas(tipo_organizacion) WHERE tipo_organizacion IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. DIAGNOSTICOS · salidas del protocolo Nexus
-- ---------------------------------------------------------------------
ALTER TABLE diagnosticos
  -- Etapa 10: nivel 1-5. Se guarda además del enum textual porque el
  -- nivel se calcula con penalizaciones y el panel necesita ordenarlo
  -- y compararlo numéricamente.
  ADD COLUMN IF NOT EXISTS nivel_madurez_numero SMALLINT
    CHECK (nivel_madurez_numero IS NULL OR nivel_madurez_numero BETWEEN 1 AND 5),

  -- Etapa 2: validación obligatoria de elegibilidad.
  ADD COLUMN IF NOT EXISTS estado_elegibilidad TEXT NOT NULL DEFAULT 'en_revision'
    CHECK (estado_elegibilidad IN ('elegible','riesgo','no_elegible','en_revision')),
  ADD COLUMN IF NOT EXISTS elegibilidad JSONB NOT NULL DEFAULT '{}',

  -- Etapa 7: riesgo financiero bajo / medio / alto.
  ADD COLUMN IF NOT EXISTS riesgo_financiero TEXT
    CHECK (riesgo_financiero IS NULL OR riesgo_financiero IN ('bajo','medio','alto')),
  ADD COLUMN IF NOT EXISTS riesgo_financiero_detalle JSONB NOT NULL DEFAULT '{}',

  -- Etapa 11: brechas técnicas, jurídicas, financieras, comerciales,
  -- institucionales y tecnológicas, con impacto, riesgo, urgencia y
  -- recomendación. Complementa (no reemplaza) diagnosticos.brechas,
  -- que sigue siendo la vista por eje que alimenta el radar.
  ADD COLUMN IF NOT EXISTS brechas_por_familia JSONB NOT NULL DEFAULT '[]',

  -- Etapa 3: clasificación con porcentaje de afinidad.
  ADD COLUMN IF NOT EXISTS clasificacion_sectorial JSONB NOT NULL DEFAULT '{}',

  -- Etapa 4: cadena servicio -> capacidad -> problema -> necesidad
  -- pública -> impacto -> comprador público.
  ADD COLUMN IF NOT EXISTS perfilamiento_oferta JSONB NOT NULL DEFAULT '{}',

  -- Etapa 12: mapa de entidades que podrían requerir los servicios.
  ADD COLUMN IF NOT EXISTS entidades_objetivo JSONB NOT NULL DEFAULT '{}',

  -- Etapa 14: plan 30/60/90/180.
  ADD COLUMN IF NOT EXISTS plan_accion JSONB NOT NULL DEFAULT '{}',

  -- Etapa 15: reporte final de 20 secciones ya ensamblado.
  ADD COLUMN IF NOT EXISTS reporte_final JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN diagnosticos.nivel_madurez_numero IS
  'Nivel 1-5 del protocolo Nexus. NO es el promedio del índice: se calcula aplicando techos por brechas críticas, riesgos y elegibilidad.';
COMMENT ON COLUMN diagnosticos.brechas_por_familia IS
  'Etapa 11: las seis familias de brecha con impacto, riesgo, urgencia y recomendación.';
COMMENT ON COLUMN diagnosticos.reporte_final IS
  'Etapa 15: las 20 secciones del reporte ya ensambladas y trazables a los motores deterministas.';

CREATE INDEX IF NOT EXISTS idx_diagnosticos_elegibilidad
  ON diagnosticos(estado_elegibilidad);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_riesgo_financiero
  ON diagnosticos(riesgo_financiero) WHERE riesgo_financiero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnosticos_nivel_numero
  ON diagnosticos(nivel_madurez_numero DESC NULLS LAST);

-- ---------------------------------------------------------------------
-- 3. CATÁLOGO IDEAPRO · servicios del portafolio institucional
-- ---------------------------------------------------------------------
-- El catálogo original cubría solo el frente de contratación pública.
-- El protocolo Nexus (etapa 13) exige poder recomendar todo el
-- portafolio: REDPRO, inteligencia territorial, formulación de
-- proyectos, cooperación internacional, marketing territorial y
-- desarrollo organizacional. Se insertan solo si no existen.
INSERT INTO catalogo_servicios (
  eje_relacionado, ejes_secundarios, nombre_servicio, descripcion, descripcion_corta,
  tipo_servicio, nivel_minimo_requerido, indice_minimo,
  precio_referencia_cop, duracion_semanas, modalidad,
  impulsa_eje, puntos_indice_esperados, orden_catalogo
)
SELECT * FROM (VALUES
  (
    'comercial'::dimension_enum, ARRAY['oferta']::dimension_enum[],
    'Inteligencia Territorial',
    'Monitoreo estructurado de planes de desarrollo, planes anuales de adquisiciones y procesos publicados en SECOP II para las entidades objetivo de la organización, con alertas y lectura de oportunidades por territorio.',
    'Sepa dónde está presupuestada la necesidad que usted resuelve',
    'Servicio recurrente', 'exploracion'::nivel_madurez_enum, 0,
    1800000, 4, 'virtual',
    'comercial'::dimension_enum, 200, 9
  ),
  (
    'comercial'::dimension_enum, ARRAY['legal']::dimension_enum[],
    'Formulación de Proyectos (MGA y SGR)',
    'Acompañamiento en la estructuración de proyectos de inversión pública bajo Metodología General Ajustada, con radicación en banco de proyectos y ruta de acceso a recursos del Sistema General de Regalías.',
    'Estructure el proyecto antes de que salga el pliego',
    'Consultoría', 'preparacion'::nivel_madurez_enum, 300,
    4500000, 10, 'mixta',
    'comercial'::dimension_enum, 250, 10
  ),
  (
    'oferta'::dimension_enum, ARRAY['comercial']::dimension_enum[],
    'Marketing Territorial',
    'Construcción del relato institucional de la organización en clave de valor público: ficha de presentación, portafolio traducido al lenguaje del Estado y estrategia de posicionamiento ante entidades objetivo.',
    'Traduzca su oferta al lenguaje del Estado',
    'Taller', 'exploracion'::nivel_madurez_enum, 100,
    1600000, 3, 'virtual',
    'oferta'::dimension_enum, 180, 11
  ),
  (
    'experiencia'::dimension_enum, ARRAY['comercial']::dimension_enum[],
    'REDPRO · Trabajo Colaborativo',
    'Vinculación a la red IDEAPRO de organizaciones para estructurar uniones temporales, consorcios y alianzas que permitan acreditar experiencia y capacidad financiera conjunta en procesos de mayor cuantía.',
    'Compita en alianza cuando aún no puede competir solo',
    'Red', 'exploracion'::nivel_madurez_enum, 0,
    900000, 6, 'mixta',
    'experiencia'::dimension_enum, 220, 12
  ),
  (
    'operativa'::dimension_enum, ARRAY['oferta']::dimension_enum[],
    'Transformación Digital y GovTech',
    'Diagnóstico y hoja de ruta de digitalización interna, y estructuración de la oferta de la organización para procesos de modernización institucional, gobierno digital e innovación pública.',
    'Digitalícese por dentro para poder digitalizar al Estado',
    'Consultoría', 'preparacion'::nivel_madurez_enum, 300,
    3800000, 8, 'mixta',
    'operativa'::dimension_enum, 240, 13
  ),
  (
    'financiera'::dimension_enum, ARRAY['comercial']::dimension_enum[],
    'Cooperación Internacional',
    'Identificación de fuentes de financiación no reembolsable, alistamiento institucional para donantes y banca multilateral, y acompañamiento en la presentación de propuestas a convocatorias internacionales.',
    'Acceda a recursos que no dependen del presupuesto público nacional',
    'Consultoría', 'lista_para_explorar'::nivel_madurez_enum, 500,
    5200000, 12, 'mixta',
    'financiera'::dimension_enum, 260, 14
  ),
  (
    'operativa'::dimension_enum, ARRAY['experiencia']::dimension_enum[],
    'Desarrollo Organizacional',
    'Fortalecimiento de la estructura interna: documentación de procesos, definición de roles, sistema de gestión de calidad y capacidad de ejecución simultánea de contratos.',
    'Ordene la casa antes de asumir dos contratos a la vez',
    'Consultoría', 'exploracion'::nivel_madurez_enum, 100,
    2800000, 8, 'presencial',
    'operativa'::dimension_enum, 210, 15
  ),
  (
    'comercial'::dimension_enum, ARRAY['operativa']::dimension_enum[],
    'Formación Especializada IDEAPRO',
    'Programa de formación en contratación estatal, ciclo de la inversión pública, lectura de pliegos y estructuración de propuestas, dirigido al equipo que asumirá la gestión del mercado público.',
    'Instale la capacidad en su equipo, no en un asesor externo',
    'Formación', 'exploracion'::nivel_madurez_enum, 0,
    1400000, 5, 'virtual',
    'comercial'::dimension_enum, 190, 16
  )
) AS nuevos (
  eje_relacionado, ejes_secundarios, nombre_servicio, descripcion, descripcion_corta,
  tipo_servicio, nivel_minimo_requerido, indice_minimo,
  precio_referencia_cop, duracion_semanas, modalidad,
  impulsa_eje, puntos_indice_esperados, orden_catalogo
)
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_servicios c WHERE c.nombre_servicio = nuevos.nombre_servicio
);

-- Dependencia funcional: no tiene sentido entrar a Formulación de
-- Proyectos sin antes tener Inteligencia Territorial, porque el
-- proyecto se formula sobre una necesidad ya identificada en el plan
-- de desarrollo de la entidad.
INSERT INTO dependencias_servicios (servicio_id, prerequisito_id, es_obligatorio)
SELECT f.id, i.id, false
FROM catalogo_servicios f, catalogo_servicios i
WHERE f.nombre_servicio = 'Formulación de Proyectos (MGA y SGR)'
  AND i.nombre_servicio = 'Inteligencia Territorial'
ON CONFLICT (servicio_id, prerequisito_id) DO NOTHING;

-- REDPRO es la vía para las organizaciones sin experiencia pública:
-- se apoya en el ajuste previo de la oferta institucional.
INSERT INTO dependencias_servicios (servicio_id, prerequisito_id, es_obligatorio)
SELECT r.id, m.id, false
FROM catalogo_servicios r, catalogo_servicios m
WHERE r.nombre_servicio = 'REDPRO · Trabajo Colaborativo'
  AND m.nombre_servicio = 'Marketing Territorial'
ON CONFLICT (servicio_id, prerequisito_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. VISTA DEL PANEL ADMINISTRATIVO
-- ---------------------------------------------------------------------
-- Se recrea la vista para exponer los nuevos ejes de segmentación que
-- el equipo IDEAPRO necesita: estado de elegibilidad, riesgo financiero,
-- nivel numérico de madurez, tipo de organización y territorio.
CREATE OR REPLACE VIEW vista_empresa_resumen AS
SELECT
  e.id                       AS empresa_id,
  e.nombre                   AS empresa_nombre,
  e.correo_contacto,
  e.canal_entrada,
  e.tipo_organizacion,
  e.ubicacion_ciudad,
  e.ubicacion_departamento,
  s.nombre                   AS sector_nombre,
  d.id                       AS ultimo_diagnostico_id,
  d.indice_ideapro,
  d.nivel_madurez_global,
  d.nivel_madurez_numero,
  d.estado_elegibilidad,
  d.riesgo_financiero,
  d.eje_critico_identificado,
  d.created_at               AS fecha_diagnostico
FROM empresas e
LEFT JOIN sectores s ON s.id = e.sector_id
LEFT JOIN LATERAL (
  SELECT * FROM diagnosticos di
  WHERE di.empresa_id = e.id
  ORDER BY di.created_at DESC
  LIMIT 1
) d ON true;
