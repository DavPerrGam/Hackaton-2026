-- IDEAPRO 2026: evolucion incremental del modelo sin eliminar datos existentes.
-- Ejecutar despues de ideapro_supabase_completa.sql.

ALTER TYPE nivel_madurez_enum ADD VALUE IF NOT EXISTS 'exploracion';
ALTER TYPE nivel_madurez_enum ADD VALUE IF NOT EXISTS 'preparacion';
ALTER TYPE nivel_madurez_enum ADD VALUE IF NOT EXISTS 'lista_para_explorar';
ALTER TYPE nivel_madurez_enum ADD VALUE IF NOT EXISTS 'preparada';
ALTER TYPE nivel_madurez_enum ADD VALUE IF NOT EXISTS 'consolidada';

ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS brechas JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS dimensiones_ideapro JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fase_ruta TEXT NOT NULL DEFAULT 'PRE'
    CHECK (fase_ruta IN ('PRE', 'DURANTE', 'EXPOST'));

ALTER TABLE documentos_chat
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vigencia DATE,
  ADD COLUMN IF NOT EXISTS estado_vigencia TEXT NOT NULL DEFAULT 'sin_verificar'
    CHECK (estado_vigencia IN ('vigente', 'por_vencer', 'vencido', 'sin_verificar')),
  ADD COLUMN IF NOT EXISTS requerido_para TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fuente TEXT NOT NULL DEFAULT 'manual' CHECK (fuente IN ('manual', 'secop_ii')),
  referencia_externa TEXT,
  nombre TEXT NOT NULL,
  entidad TEXT,
  territorio TEXT,
  descripcion TEXT,
  url_fuente TEXT,
  fecha_cierre TIMESTAMPTZ,
  requisitos JSONB NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada', 'en_revision')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (fuente, referencia_externa)
);

CREATE TABLE IF NOT EXISTS postulaciones_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE NOT NULL,
  diagnostico_id UUID REFERENCES diagnosticos(id),
  fase TEXT NOT NULL DEFAULT 'DURANTE' CHECK (fase IN ('PRE', 'DURANTE', 'EXPOST')),
  estado TEXT NOT NULL DEFAULT 'recomendada' CHECK (estado IN ('recomendada', 'en_preparacion', 'enviada', 'adjudicada', 'no_adjudicada', 'retirada')),
  porcentaje_encaje INTEGER CHECK (porcentaje_encaje BETWEEN 0 AND 100),
  brechas JSONB NOT NULL DEFAULT '[]',
  notas TEXT,
  perfilamiento JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (empresa_id, oportunidad_id)
);

CREATE TABLE IF NOT EXISTS resultados_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  postulacion_id UUID REFERENCES postulaciones_oportunidad(id) ON DELETE CASCADE NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('adjudicada', 'no_adjudicada', 'cancelada', 'sin_respuesta')),
  dificultades TEXT,
  aprendizajes TEXT,
  nuevas_brechas JSONB NOT NULL DEFAULT '[]',
  fecha_resultado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS tareas_postulacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  postulacion_id UUID REFERENCES postulaciones_oportunidad(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('brecha', 'documento', 'entrega', 'acompanamiento', 'otro')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_limite TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (postulacion_id, titulo)
);

CREATE TABLE IF NOT EXISTS formaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  proveedor TEXT,
  url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS resultados_formacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  formacion_id UUID REFERENCES formaciones(id) ON DELETE CASCADE NOT NULL,
  diagnostico_origen_id UUID REFERENCES diagnosticos(id),
  diagnostico_reevaluacion_id UUID REFERENCES diagnosticos(id),
  estado TEXT NOT NULL DEFAULT 'asignada' CHECK (estado IN ('asignada', 'en_curso', 'completada', 'cancelada')),
  resultado TEXT,
  completada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (empresa_id, formacion_id, diagnostico_origen_id)
);

ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS territorio TEXT;

ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS actualizado_fuente_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload_fuente JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alertas_habilitadas BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL;

ALTER TABLE postulaciones_oportunidad
  ADD COLUMN IF NOT EXISTS perfilamiento JSONB NOT NULL DEFAULT '{}';

DROP TRIGGER IF EXISTS trg_oportunidades_updated_at ON oportunidades;
CREATE TRIGGER trg_oportunidades_updated_at
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_postulaciones_updated_at ON postulaciones_oportunidad;
CREATE TRIGGER trg_postulaciones_updated_at
  BEFORE UPDATE ON postulaciones_oportunidad
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_postulaciones_empresa ON postulaciones_oportunidad(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resultados_formacion_empresa ON resultados_formacion(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tareas_postulacion ON tareas_postulacion(postulacion_id, fecha_limite);
CREATE UNIQUE INDEX IF NOT EXISTS uq_resultados_formacion_origen
  ON resultados_formacion(empresa_id, formacion_id, diagnostico_origen_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_oportunidades_fuente_referencia_normalizada
  ON oportunidades (fuente, lower(trim(referencia_externa)))
  WHERE referencia_externa IS NOT NULL AND trim(referencia_externa) <> '';
CREATE INDEX IF NOT EXISTS idx_oportunidades_estado_cierre
  ON oportunidades(estado, fecha_cierre);
CREATE INDEX IF NOT EXISTS idx_oportunidades_fuente_actualizacion
  ON oportunidades(fuente, actualizado_fuente_at DESC);

ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE postulaciones_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_postulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE formaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_formacion ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON oportunidades, postulaciones_oportunidad,
  resultados_oportunidad, tareas_postulacion, formaciones, resultados_formacion TO service_role;
