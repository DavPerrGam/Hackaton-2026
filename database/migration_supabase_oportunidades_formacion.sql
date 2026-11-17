-- IDEAPRO 2026
-- Migracion incremental para una base Supabase existente.
-- No elimina tablas ni inserta datos ficticios de SECOP II.
-- Ejecutar despues del esquema base de IDEAPRO.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.diagnosticos
  ADD COLUMN IF NOT EXISTS dimensiones_ideapro JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS uq_diagnosticos_sesion
  ON public.diagnosticos (sesion_id)
  WHERE sesion_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.oportunidades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fuente TEXT NOT NULL DEFAULT 'manual'
    CHECK (fuente IN ('manual', 'secop_ii')),
  referencia_externa TEXT,
  nombre TEXT NOT NULL,
  entidad TEXT,
  territorio TEXT,
  descripcion TEXT,
  url_fuente TEXT,
  fecha_cierre TIMESTAMPTZ,
  requisitos JSONB NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'abierta'
    CHECK (estado IN ('abierta', 'cerrada', 'en_revision')),
  actualizado_fuente_at TIMESTAMPTZ,
  payload_fuente JSONB NOT NULL DEFAULT '{}',
  alertas_habilitadas BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.oportunidades
  ADD COLUMN IF NOT EXISTS fuente TEXT,
  ADD COLUMN IF NOT EXISTS referencia_externa TEXT,
  ADD COLUMN IF NOT EXISTS entidad TEXT,
  ADD COLUMN IF NOT EXISTS territorio TEXT,
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS url_fuente TEXT,
  ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requisitos JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'abierta',
  ADD COLUMN IF NOT EXISTS actualizado_fuente_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload_fuente JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alertas_habilitadas BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_oportunidades_fuente_referencia
  ON public.oportunidades (fuente, lower(trim(referencia_externa)))
  WHERE referencia_externa IS NOT NULL AND trim(referencia_externa) <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_oportunidades_fuente_referencia_constraint'
      AND conrelid = 'public.oportunidades'::regclass
  ) THEN
    ALTER TABLE public.oportunidades
      ADD CONSTRAINT uq_oportunidades_fuente_referencia_constraint
      UNIQUE (fuente, referencia_externa);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oportunidades_estado_cierre
  ON public.oportunidades (estado, fecha_cierre);

CREATE INDEX IF NOT EXISTS idx_oportunidades_fuente_actualizacion
  ON public.oportunidades (fuente, actualizado_fuente_at DESC);

DROP TRIGGER IF EXISTS trg_oportunidades_updated_at ON public.oportunidades;
CREATE TRIGGER trg_oportunidades_updated_at
  BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.postulaciones_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  oportunidad_id UUID REFERENCES public.oportunidades(id) ON DELETE CASCADE NOT NULL,
  diagnostico_id UUID REFERENCES public.diagnosticos(id),
  fase TEXT NOT NULL DEFAULT 'PRE'
    CHECK (fase IN ('PRE', 'DURANTE', 'EXPOST')),
  estado TEXT NOT NULL DEFAULT 'recomendada'
    CHECK (estado IN ('recomendada', 'en_preparacion', 'enviada', 'adjudicada', 'no_adjudicada', 'retirada')),
  porcentaje_encaje INTEGER CHECK (porcentaje_encaje BETWEEN 0 AND 100),
  brechas JSONB NOT NULL DEFAULT '[]',
  notas TEXT,
  perfilamiento JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (empresa_id, oportunidad_id)
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_empresa
  ON public.postulaciones_oportunidad (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_postulaciones_fase_estado
  ON public.postulaciones_oportunidad (fase, estado, updated_at DESC);

DROP TRIGGER IF EXISTS trg_postulaciones_updated_at ON public.postulaciones_oportunidad;
CREATE TRIGGER trg_postulaciones_updated_at
  BEFORE UPDATE ON public.postulaciones_oportunidad
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.resultados_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  postulacion_id UUID REFERENCES public.postulaciones_oportunidad(id) ON DELETE CASCADE NOT NULL,
  resultado TEXT NOT NULL
    CHECK (resultado IN ('adjudicada', 'no_adjudicada', 'cancelada', 'sin_respuesta')),
  dificultades TEXT,
  aprendizajes TEXT,
  nuevas_brechas JSONB NOT NULL DEFAULT '[]',
  fecha_resultado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.alertas_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  oportunidad_id UUID REFERENCES public.oportunidades(id) ON DELETE CASCADE NOT NULL,
  postulacion_id UUID REFERENCES public.postulaciones_oportunidad(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('cierre_proximo', 'requisito_faltante', 'documento_por_vencer', 'nueva_oportunidad')),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviada', 'leida', 'descartada')),
  fecha_programada TIMESTAMPTZ,
  leida_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (postulacion_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alertas_empresa_estado
  ON public.alertas_oportunidad(empresa_id, estado, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tareas_postulacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  postulacion_id UUID REFERENCES public.postulaciones_oportunidad(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('brecha', 'documento', 'entrega', 'acompanamiento', 'otro')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_limite TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (postulacion_id, titulo)
);

CREATE INDEX IF NOT EXISTS idx_tareas_postulacion
  ON public.tareas_postulacion (postulacion_id, fecha_limite);

DROP TRIGGER IF EXISTS trg_tareas_postulacion_updated_at ON public.tareas_postulacion;
CREATE TRIGGER trg_tareas_postulacion_updated_at
  BEFORE UPDATE ON public.tareas_postulacion
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.formaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  servicio_id UUID REFERENCES public.catalogo_servicios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  proveedor TEXT,
  url TEXT,
  objetivo TEXT,
  evidencia_requerida TEXT,
  duracion_horas INTEGER CHECK (duracion_horas > 0),
  contenido JSONB NOT NULL DEFAULT '[]',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.formaciones
  ADD COLUMN IF NOT EXISTS objetivo TEXT,
  ADD COLUMN IF NOT EXISTS evidencia_requerida TEXT,
  ADD COLUMN IF NOT EXISTS duracion_horas INTEGER,
  ADD COLUMN IF NOT EXISTS contenido JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS public.resultados_formacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  formacion_id UUID REFERENCES public.formaciones(id) ON DELETE CASCADE NOT NULL,
  diagnostico_origen_id UUID REFERENCES public.diagnosticos(id),
  diagnostico_reevaluacion_id UUID REFERENCES public.diagnosticos(id),
  estado TEXT NOT NULL DEFAULT 'asignada'
    CHECK (estado IN ('asignada', 'en_curso', 'completada', 'cancelada')),
  resultado TEXT,
  completada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (empresa_id, formacion_id, diagnostico_origen_id)
);

CREATE INDEX IF NOT EXISTS idx_resultados_formacion_empresa
  ON public.resultados_formacion (empresa_id, created_at DESC);

ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_postulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_oportunidad ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postulaciones_oportunidad TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultados_oportunidad TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tareas_postulacion TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formaciones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultados_formacion TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_oportunidad TO service_role;

-- Verificacion posterior en Supabase:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('oportunidades', 'postulaciones_oportunidad',
--   'resultados_oportunidad', 'tareas_postulacion', 'formaciones',
--   'resultados_formacion')
-- ORDER BY table_name;
