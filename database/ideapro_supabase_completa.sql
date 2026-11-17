-- ================================================================
-- IDEAPRO - BASE DE DATOS COMPLETA PARA SUPABASE
-- Ejecutar en un proyecto Supabase NUEVO o VACIO.
-- Este script elimina tablas IDEAPRO existentes y las recrea.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP VIEW IF EXISTS vista_empresa_resumen CASCADE;
DROP TABLE IF EXISTS documentos_chat CASCADE;
DROP TABLE IF EXISTS resultados_formacion CASCADE;
DROP TABLE IF EXISTS formaciones CASCADE;
DROP TABLE IF EXISTS tareas_postulacion CASCADE;
DROP TABLE IF EXISTS resultados_oportunidad CASCADE;
DROP TABLE IF EXISTS alertas_oportunidad CASCADE;
DROP TABLE IF EXISTS postulaciones_oportunidad CASCADE;
DROP TABLE IF EXISTS oportunidades CASCADE;
DROP TABLE IF EXISTS encaje_oportunidad CASCADE;
DROP TABLE IF EXISTS ruta_recomendada CASCADE;
DROP TABLE IF EXISTS dependencias_servicios CASCADE;
DROP TABLE IF EXISTS hitos_empresa CASCADE;
DROP TABLE IF EXISTS interacciones_agente CASCADE;
DROP TABLE IF EXISTS diagnosticos CASCADE;
DROP TABLE IF EXISTS sesiones CASCADE;
DROP TABLE IF EXISTS catalogo_servicios CASCADE;
DROP TABLE IF EXISTS tipos_oportunidad CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;
DROP TABLE IF EXISTS sectores CASCADE;
DROP TABLE IF EXISTS bitacora_auditoria CASCADE;
DROP TABLE IF EXISTS administradores CASCADE;
DROP TABLE IF EXISTS usuarios_publicos CASCADE;

DROP TYPE IF EXISTS dimension_enum CASCADE;
DROP TYPE IF EXISTS estado_ruta_enum CASCADE;
DROP TYPE IF EXISTS nivel_madurez_enum CASCADE;
DROP TYPE IF EXISTS canal_entrada_enum CASCADE;
DROP TYPE IF EXISTS estado_hito_enum CASCADE;
DROP TYPE IF EXISTS estado_sesion_enum CASCADE;
DROP TYPE IF EXISTS rol_admin_enum CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TYPE dimension_enum AS ENUM (
  'oferta','experiencia','operativa','legal','financiera','comercial'
);

CREATE TYPE estado_ruta_enum AS ENUM (
  'pendiente','en_progreso','completado','descartado'
);

CREATE TYPE nivel_madurez_enum AS ENUM (
  'inicial','en_desarrollo','intermedio','avanzado'
  ,'exploracion','preparacion','lista_para_explorar','preparada','consolidada'
);

CREATE TYPE canal_entrada_enum AS ENUM (
  'web','whatsapp','presencial','referido','api'
);

CREATE TYPE estado_hito_enum AS ENUM (
  'bloqueado','disponible','en_progreso','completado'
);

CREATE TYPE estado_sesion_enum AS ENUM (
  'en_curso','completada','abandonada'
);

CREATE TYPE rol_admin_enum AS ENUM (
  'superadmin','analista'
);

-- ================================================================
-- USUARIOS Y ADMINISTRADORES
-- ================================================================

CREATE TABLE administradores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol rol_admin_enum NOT NULL DEFAULT 'analista',
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  login_intentos INTEGER DEFAULT 0,
  login_bloqueado_hasta TIMESTAMPTZ,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE usuarios_publicos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE bitacora_auditoria (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  administrador_id UUID REFERENCES administradores(id),
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  registro_id UUID,
  descripcion TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TRIGGER trg_admin_updated_at
  BEFORE UPDATE ON administradores
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX idx_usuarios_publicos_correo ON usuarios_publicos(correo);
CREATE INDEX idx_bitacora_admin ON bitacora_auditoria(administrador_id);

-- ================================================================
-- SECTORES Y EMPRESAS
-- ================================================================

CREATE TABLE sectores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  codigo_ciiu TEXT,
  descripcion TEXT,
  peso_ejes JSONB NOT NULL DEFAULT '{"oferta":1,"experiencia":1,"operativa":1,"legal":1,"financiera":1,"comercial":1}',
  requisitos_clave TEXT[] DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE empresas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nit TEXT UNIQUE,
  nombre_contacto TEXT,
  correo_contacto TEXT,
  telefono_contacto TEXT,
  sector_id UUID REFERENCES sectores(id),
  sector_texto TEXT,
  tipo_bien_servicio TEXT,
  ubicacion_ciudad TEXT,
  ubicacion_departamento TEXT,
  anios_operacion NUMERIC CHECK (anios_operacion >= 0),
  rango_ventas TEXT,
  ventas_ultimo_anio_cop BIGINT CHECK (ventas_ultimo_anio_cop >= 0),
  tamanio_equipo INTEGER CHECK (tamanio_equipo > 0),
  tiene_rup BOOLEAN DEFAULT false,
  experiencia_previa_contratos BOOLEAN DEFAULT false,
  num_contratos_previos INTEGER DEFAULT 0 CHECK (num_contratos_previos >= 0),
  certificaciones BOOLEAN DEFAULT false,
  certificaciones_lista TEXT[] DEFAULT '{}',
  canal_entrada canal_entrada_enum DEFAULT 'web',
  objetivo_6_meses TEXT,
  referido_por TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT empresas_correo_formato CHECK (
    correo_contacto IS NULL OR correo_contacto ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX idx_empresas_sector ON empresas(sector_id);
CREATE INDEX idx_empresas_correo ON empresas(correo_contacto);

-- ================================================================
-- SESIONES, INTERACCIONES Y ELEGIBILIDAD
-- ================================================================

CREATE TABLE sesiones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_publico_id UUID REFERENCES usuarios_publicos(id),
  numero_sesion INTEGER DEFAULT 1 NOT NULL,
  canal canal_entrada_enum DEFAULT 'web',
  paso_actual INTEGER NOT NULL DEFAULT 0,
  respuestas JSONB NOT NULL DEFAULT '{}',
  estado estado_sesion_enum NOT NULL DEFAULT 'en_curso',
  estado_elegibilidad TEXT NOT NULL DEFAULT 'en_revision'
    CHECK (estado_elegibilidad IN ('elegible','no_elegible','en_revision')),
  motivo_bloqueo TEXT,
  resumen TEXT,
  mensajes_raw JSONB DEFAULT '[]',
  contexto_embedding_json JSONB,
  completada BOOLEAN DEFAULT false,
  fecha_finalizacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TRIGGER trg_sesiones_updated_at
  BEFORE UPDATE ON sesiones
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE interacciones_agente (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  fase TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  respuesta_ia TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_sesiones_empresa ON sesiones(empresa_id);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_publico_id);
CREATE INDEX idx_sesiones_estado ON sesiones(estado);
CREATE INDEX idx_sesiones_elegibilidad ON sesiones(estado_elegibilidad);
CREATE INDEX idx_interacciones_sesion ON interacciones_agente(sesion_id, created_at);
CREATE INDEX idx_interacciones_empresa ON interacciones_agente(empresa_id, created_at);

-- ================================================================
-- DIAGNOSTICOS
-- ================================================================

CREATE TABLE diagnosticos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  sesion_id UUID REFERENCES sesiones(id),
  numero_visita INTEGER DEFAULT 1 NOT NULL,
  score_oferta INTEGER NOT NULL CHECK (score_oferta BETWEEN 0 AND 100),
  score_experiencia INTEGER NOT NULL CHECK (score_experiencia BETWEEN 0 AND 100),
  score_operativa INTEGER NOT NULL CHECK (score_operativa BETWEEN 0 AND 100),
  score_legal INTEGER NOT NULL CHECK (score_legal BETWEEN 0 AND 100),
  score_financiera INTEGER NOT NULL CHECK (score_financiera BETWEEN 0 AND 100),
  score_comercial INTEGER NOT NULL CHECK (score_comercial BETWEEN 0 AND 100),
  indice_ideapro INTEGER GENERATED ALWAYS AS (
    (score_oferta + score_experiencia + score_operativa + score_legal + score_financiera + score_comercial) * 10 / 6
  ) STORED,
  nivel_madurez_global nivel_madurez_enum NOT NULL,
  eje_critico_identificado dimension_enum NOT NULL,
  brechas JSONB NOT NULL DEFAULT '[]',
  dimensiones_ideapro JSONB NOT NULL DEFAULT '{}',
  fase_ruta TEXT NOT NULL DEFAULT 'PRE' CHECK (fase_ruta IN ('PRE', 'DURANTE', 'EXPOST')),
  radar_data JSONB,
  resumen_conversacion TEXT,
  resumen_ia TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_diagnosticos_empresa ON diagnosticos(empresa_id);
CREATE INDEX idx_diagnosticos_sesion ON diagnosticos(sesion_id);
CREATE INDEX idx_diagnosticos_fecha ON diagnosticos(empresa_id, created_at DESC);
CREATE UNIQUE INDEX uq_diagnosticos_sesion ON diagnosticos(sesion_id) WHERE sesion_id IS NOT NULL;

-- ================================================================
-- DOCUMENTOS Y ARCHIVOS
-- ================================================================

CREATE TABLE documentos_chat (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE CASCADE NOT NULL,
  usuario_publico_id UUID REFERENCES usuarios_publicos(id) ON DELETE CASCADE NOT NULL,
  nombre_original TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg','image/png','image/webp'
  )),
  tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760),
  storage_path TEXT NOT NULL UNIQUE,
  texto_extraido TEXT,
  categoria TEXT,
  fecha_vigencia DATE,
  estado_vigencia TEXT NOT NULL DEFAULT 'sin_verificar'
    CHECK (estado_vigencia IN ('vigente', 'por_vencer', 'vencido', 'sin_verificar')),
  requerido_para TEXT[] NOT NULL DEFAULT '{}',
  estado_procesamiento TEXT NOT NULL DEFAULT 'procesado'
    CHECK (estado_procesamiento IN ('pendiente','procesado','error')),
  error_procesamiento TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TRIGGER trg_documentos_updated_at
  BEFORE UPDATE ON documentos_chat
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX idx_documentos_diagnostico ON documentos_chat(diagnostico_id, created_at);
CREATE INDEX idx_documentos_usuario ON documentos_chat(usuario_publico_id, created_at);

-- ================================================================
-- CATALOGO Y RECOMENDACIONES
-- ================================================================

CREATE TABLE catalogo_servicios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  eje_relacionado dimension_enum NOT NULL,
  ejes_secundarios dimension_enum[] DEFAULT '{}',
  nombre_servicio TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  descripcion_corta TEXT,
  tipo_servicio TEXT NOT NULL,
  nivel_minimo_requerido nivel_madurez_enum,
  indice_minimo INTEGER DEFAULT 0 CHECK (indice_minimo BETWEEN 0 AND 1000),
  precio_referencia_cop BIGINT CHECK (precio_referencia_cop >= 0),
  duracion_semanas INTEGER CHECK (duracion_semanas > 0),
  modalidad TEXT,
  impulsa_eje dimension_enum,
  puntos_indice_esperados INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  orden_catalogo INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TRIGGER trg_catalogo_updated_at
  BEFORE UPDATE ON catalogo_servicios
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE dependencias_servicios (
  servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE CASCADE NOT NULL,
  prerequisito_id UUID REFERENCES catalogo_servicios(id) ON DELETE CASCADE NOT NULL,
  es_obligatorio BOOLEAN DEFAULT false,
  PRIMARY KEY (servicio_id, prerequisito_id),
  CHECK (servicio_id <> prerequisito_id)
);

CREATE TABLE ruta_recomendada (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE CASCADE NOT NULL,
  servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE CASCADE NOT NULL,
  orden_prioridad INTEGER NOT NULL CHECK (orden_prioridad > 0),
  estado estado_ruta_enum DEFAULT 'pendiente' NOT NULL,
  justificacion_ia TEXT,
  fecha_objetivo DATE,
  fecha_completado TIMESTAMPTZ,
  notas_seguimiento TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (diagnostico_id, servicio_id)
);

CREATE TRIGGER trg_ruta_updated_at
  BEFORE UPDATE ON ruta_recomendada
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE tipos_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  modalidad_contratacion TEXT,
  sectores_aplicables TEXT[] DEFAULT '{}',
  requisitos_por_eje JSONB DEFAULT '{}',
  valor_referencia_cop BIGINT CHECK (valor_referencia_cop >= 0),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE encaje_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  diagnostico_id UUID REFERENCES diagnosticos(id) ON DELETE CASCADE NOT NULL,
  oportunidad_id UUID REFERENCES tipos_oportunidad(id) ON DELETE CASCADE NOT NULL,
  porcentaje_encaje INTEGER NOT NULL CHECK (porcentaje_encaje BETWEEN 0 AND 100),
  brechas_identificadas JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (diagnostico_id, oportunidad_id)
);

CREATE TABLE hitos_empresa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  servicio_asociado UUID REFERENCES catalogo_servicios(id),
  desbloqueado_por UUID REFERENCES hitos_empresa(id),
  nombre_hito TEXT NOT NULL,
  descripcion TEXT,
  eje_relacionado dimension_enum,
  orden INTEGER NOT NULL,
  estado estado_hito_enum DEFAULT 'bloqueado' NOT NULL,
  puntos_otorgados INTEGER DEFAULT 0,
  fecha_disponible DATE,
  fecha_completado TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TRIGGER trg_hitos_updated_at
  BEFORE UPDATE ON hitos_empresa
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX idx_catalogo_activo_eje
  ON catalogo_servicios(activo, eje_relacionado)
  WHERE activo = true;
CREATE INDEX idx_ruta_diagnostico
  ON ruta_recomendada(diagnostico_id, orden_prioridad);
CREATE INDEX idx_encaje_diagnostico
  ON encaje_oportunidad(diagnostico_id);

-- ================================================================
-- OPORTUNIDADES REALES Y ACOMPANAMIENTO PRE/DURANTE/EXPOST
-- La fuente secop_ii identifica el adaptador externo; no implica que
-- este script invente ni sincronice datos de SECOP.
-- ================================================================

CREATE TABLE oportunidades (
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
  actualizado_fuente_at TIMESTAMPTZ,
  payload_fuente JSONB NOT NULL DEFAULT '{}',
  alertas_habilitadas BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE UNIQUE INDEX uq_oportunidades_fuente_referencia
  ON oportunidades (fuente, lower(trim(referencia_externa)))
  WHERE referencia_externa IS NOT NULL AND trim(referencia_externa) <> '';
ALTER TABLE oportunidades
  ADD CONSTRAINT uq_oportunidades_fuente_referencia_constraint UNIQUE (fuente, referencia_externa);
CREATE INDEX idx_oportunidades_estado_cierre ON oportunidades(estado, fecha_cierre);
CREATE INDEX idx_oportunidades_fuente_actualizacion ON oportunidades(fuente, actualizado_fuente_at DESC);

CREATE TRIGGER trg_oportunidades_updated_at
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE postulaciones_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE NOT NULL,
  diagnostico_id UUID REFERENCES diagnosticos(id),
  fase TEXT NOT NULL DEFAULT 'PRE' CHECK (fase IN ('PRE', 'DURANTE', 'EXPOST')),
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

CREATE INDEX idx_postulaciones_empresa ON postulaciones_oportunidad(empresa_id, created_at DESC);
CREATE INDEX idx_postulaciones_fase_estado ON postulaciones_oportunidad(fase, estado, updated_at DESC);
CREATE TRIGGER trg_postulaciones_updated_at
  BEFORE UPDATE ON postulaciones_oportunidad
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE resultados_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  postulacion_id UUID REFERENCES postulaciones_oportunidad(id) ON DELETE CASCADE NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('adjudicada', 'no_adjudicada', 'cancelada', 'sin_respuesta')),
  dificultades TEXT,
  aprendizajes TEXT,
  nuevas_brechas JSONB NOT NULL DEFAULT '[]',
  fecha_resultado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE alertas_oportunidad (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE NOT NULL,
  postulacion_id UUID REFERENCES postulaciones_oportunidad(id) ON DELETE CASCADE,
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

CREATE INDEX idx_alertas_empresa_estado ON alertas_oportunidad(empresa_id, estado, created_at DESC);
CREATE INDEX idx_alertas_programadas ON alertas_oportunidad(fecha_programada, estado);

CREATE TABLE tareas_postulacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  postulacion_id UUID REFERENCES postulaciones_oportunidad(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('brecha', 'documento', 'entrega', 'acompanamiento', 'otro')),
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

CREATE INDEX idx_tareas_postulacion ON tareas_postulacion(postulacion_id, fecha_limite);
CREATE TRIGGER trg_tareas_postulacion_updated_at
  BEFORE UPDATE ON tareas_postulacion
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ================================================================
-- FORMACION Y REEVALUACION
-- ================================================================

CREATE TABLE formaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL,
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

CREATE TABLE resultados_formacion (
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

CREATE INDEX idx_resultados_formacion_empresa ON resultados_formacion(empresa_id, created_at DESC);

-- ================================================================
-- VISTA ADMINISTRATIVA
-- ================================================================

CREATE OR REPLACE VIEW vista_empresa_resumen AS
SELECT
  e.id AS empresa_id,
  e.nombre AS empresa_nombre,
  e.correo_contacto,
  e.canal_entrada,
  s.nombre AS sector_nombre,
  d.id AS ultimo_diagnostico_id,
  d.indice_ideapro,
  d.nivel_madurez_global,
  d.eje_critico_identificado,
  d.created_at AS fecha_diagnostico
FROM empresas e
LEFT JOIN sectores s ON s.id = e.sector_id
LEFT JOIN LATERAL (
  SELECT * FROM diagnosticos di
  WHERE di.empresa_id = e.id
  ORDER BY di.created_at DESC
  LIMIT 1
) d ON true;

-- ================================================================
-- RLS Y STORAGE
-- ================================================================

ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE interacciones_agente ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencias_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruta_recomendada ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE encaje_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitos_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE postulaciones_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_oportunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_postulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE formaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_formacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_oportunidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_publico_select" ON catalogo_servicios
  FOR SELECT USING (activo = true);

CREATE POLICY "sectores_publicos_select" ON sectores
  FOR SELECT USING (activo = true);

CREATE POLICY "oportunidades_publicas_select" ON tipos_oportunidad
  FOR SELECT USING (activo = true);

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ideapro-documentos', 'ideapro-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- DATOS INICIALES
-- ================================================================

INSERT INTO sectores (nombre, codigo_ciiu, descripcion, requisitos_clave) VALUES
('Tecnologia e Informacion', '6201', 'Desarrollo de software y servicios tecnologicos.', ARRAY['RUP vigente','Experiencia en proyectos similares']),
('Construccion e Infraestructura', '4111', 'Obras civiles y mantenimiento de infraestructura.', ARRAY['RUP vigente','Polizas de cumplimiento']),
('Salud y Servicios Medicos', '8610', 'Servicios de salud y dispositivos medicos.', ARRAY['Habilitacion sanitaria','RUP vigente']),
('Agroindustria', '0111', 'Produccion y comercializacion agropecuaria.', ARRAY['RUP vigente','Registros ICA o INVIMA']),
('Consultoria y Capacitacion', '7020', 'Consultoria profesional y formacion empresarial.', ARRAY['RUP vigente','Experiencia demostrable']),
('Suministros y Bienes', '4610', 'Comercio de materiales, equipos y suministros.', ARRAY['RUP vigente','Capacidad logistica'])
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO catalogo_servicios (
  eje_relacionado, ejes_secundarios, nombre_servicio, descripcion,
  descripcion_corta, tipo_servicio, nivel_minimo_requerido,
  indice_minimo, precio_referencia_cop, duracion_semanas,
  modalidad, impulsa_eje, puntos_indice_esperados, orden_catalogo
) VALUES
('legal','{financiera}','Asesoria Juridica Puntual','Revision de requisitos legales, RUP y pliegos.','Revision de requisitos legales','Consultoria','inicial',0,800000,2,'virtual','legal',150,1),
('legal',NULL,'Estructuracion RUP','Acompanamiento para inscripcion o actualizacion del RUP.','Inscripcion o actualizacion del RUP','Tramite','inicial',0,1200000,3,'presencial','legal',200,2),
('financiera','{operativa}','Estructuracion de Propuestas','Apoyo para capacidad financiera y oferta economica.','Estructura tu oferta economica','Asesoria','en_desarrollo',300,1500000,4,'virtual','financiera',200,3),
('financiera',NULL,'Gestion de Polizas','Asesoria para garantias y polizas de contratacion.','Obtencion de garantias','Consultoria','en_desarrollo',250,600000,1,'virtual','financiera',100,4),
('comercial','{oferta}','Mentoria Comercial','Estrategia para identificar oportunidades en SECOP II.','Estrategia comercial publica','Mentoria','intermedio',500,2000000,8,'mixta','comercial',250,5),
('oferta','{comercial}','Ajuste de Portafolio','Alineacion de la oferta al mercado publico.','Adecua tu oferta','Taller','inicial',150,900000,2,'virtual','oferta',150,6),
('experiencia',NULL,'Certificacion de Calidad','Ruta para certificaciones de calidad.','Guia para certificaciones','Asesoria','intermedio',450,3500000,16,'mixta','experiencia',300,7),
('operativa','{financiera}','Optimizacion de Procesos','Auditoria y mejora de capacidad operativa.','Auditoria de capacidad','Consultoria','en_desarrollo',350,2500000,6,'presencial','operativa',200,8)
ON CONFLICT DO NOTHING;

INSERT INTO tipos_oportunidad (
  nombre, descripcion, modalidad_contratacion,
  sectores_aplicables, requisitos_por_eje, valor_referencia_cop
) VALUES
('Minima Cuantia - TI y Software','Contratacion de software y servicios tecnologicos.','Minima cuantia',ARRAY['Tecnologia e Informacion'],'{"legal":35,"financiera":25,"oferta":45,"experiencia":20,"operativa":25,"comercial":20}',28000000),
('Licitacion Publica - Infraestructura','Obras civiles e infraestructura de gran escala.','Licitacion publica',ARRAY['Construccion e Infraestructura'],'{"legal":75,"financiera":70,"oferta":55,"experiencia":70,"operativa":80,"comercial":45}',500000000),
('Concurso de Meritos - Consultoria','Consultoria tecnica, estudios e interventoria.','Concurso de meritos',ARRAY['Consultoria y Capacitacion','Tecnologia e Informacion'],'{"legal":55,"financiera":35,"oferta":70,"experiencia":65,"operativa":35,"comercial":55}',120000000),
('Seleccion Abreviada - Suministros','Adquisicion de bienes y equipos.','Seleccion abreviada',ARRAY['Suministros y Bienes','Agroindustria'],'{"legal":55,"financiera":50,"oferta":45,"experiencia":35,"operativa":55,"comercial":30}',80000000),
('Minima Cuantia - Servicios Profesionales','Contratos de capacitacion y asesoria.','Minima cuantia',ARRAY['Consultoria y Capacitacion','Salud y Servicios Medicos'],'{"legal":30,"financiera":20,"oferta":50,"experiencia":40,"operativa":20,"comercial":35}',18000000)
ON CONFLICT DO NOTHING;

-- Formaciones internas de referencia para que el flujo sea demostrable.
-- No representan cursos externos ni datos de SECOP.
INSERT INTO formaciones (servicio_id, nombre, descripcion, proveedor, url, objetivo, evidencia_requerida, duracion_horas, contenido)
SELECT cs.id, datos.nombre, datos.descripcion, 'IDEAPRO', NULL, datos.objetivo, datos.evidencia, datos.horas, datos.contenido
FROM catalogo_servicios cs
JOIN (VALUES
  ('Estructuracion de Propuestas', 'Taller interno de requisitos, propuesta tecnica y oferta economica.', 'Construir una propuesta verificable.', 'Borrador tecnico y oferta economica', 8, '["requisitos", "propuesta", "presupuesto"]'::jsonb),
  ('Gestion de Polizas', 'Orientacion interna para preparar garantias y soportes de cumplimiento.', 'Preparar soportes para solicitar garantias.', 'Cotizacion o certificado de garantia', 4, '["riesgos", "garantias", "soportes"]'::jsonb),
  ('Mentoria Comercial', 'Taller interno para monitorear oportunidades y organizar la estrategia comercial.', 'Definir un proceso semanal de monitoreo.', 'Tablero de oportunidades priorizadas', 6, '["segmentacion", "monitoreo", "seguimiento"]'::jsonb),
  ('Optimizacion de Procesos', 'Ruta interna para documentar procesos y evidenciar capacidad operativa.', 'Documentar un proceso critico de entrega.', 'Procedimiento y evidencia de control', 10, '["mapa", "procedimiento", "indicadores"]'::jsonb)
) AS datos(nombre, descripcion, objetivo, evidencia, horas, contenido) ON datos.nombre = cs.nombre_servicio
WHERE NOT EXISTS (
  SELECT 1 FROM formaciones f WHERE f.servicio_id = cs.id AND f.nombre = datos.nombre
);

COMMIT;

-- Luego crea el administrador desde el backend:
-- npm run create-admin -- "David Medina" david@ideapro.com "TuClaveSegura"
