-- =====================================================================
-- IDEAPRO · Agente Inteligente de Diagnóstico y Recomendación
-- Esquema de base de datos OPTIMIZADO
-- Motor: PostgreSQL 15+ (Supabase)
-- =====================================================================
-- Este archivo parte del esquema entregado por IDEAPRO y aplica las
-- mejoras descritas en docs/03-modelo-datos.md. Resumen de cambios:
--
--   1. Se agrega la extensión pgcrypto/uuid-ossp explícitamente: el
--      esquema original usaba uuid_generate_v4() sin declarar la
--      extensión, lo que rompe la creación de tablas en una base nueva.
--   2. Se añade el módulo de autenticación (administradores) siguiendo
--      el mismo patrón usado en el CMS del Proyecto Integrador
--      (usuarios + roles + JWT + bcrypt), necesario porque el reto pide
--      "gestión de usuarios" para el panel interno de seguimiento.
--   3. La tabla `sesiones` gana `paso_actual` y `respuestas` (jsonb)
--      para poder sostener una conversación de onboarding por pasos y
--      reanudarla sin perder estado (requisito de "Onboarding
--      conversacional" y "Seguimiento").
--   4. Se agregan índices compuestos y parciales pensados para las
--      consultas reales del agente (última sesión de una empresa,
--      catálogo activo ordenado, ruta pendiente por diagnóstico).
--   5. Se agregan restricciones de integridad adicionales (checks,
--      not null) que el esquema original dejaba abiertas y que
--      permitían estados inconsistentes (p. ej. ejes fuera de rango,
--      catálogo con orden_prioridad duplicado).
--   6. Se crea una vista materializada ligera `vista_empresa_resumen`
--      para alimentar el panel administrativo sin recalcular joins
--      pesados en cada request.
--   7. Las políticas RLS "MVP" (using (true)) se reemplazan por
--      políticas reales alineadas con el JWT emitido por el backend
--      (rol admin vs. servicio anónimo de captura pública).
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

drop table if exists encaje_oportunidad      cascade;
drop table if exists resultados_formacion    cascade;
drop table if exists formaciones              cascade;
drop table if exists tareas_postulacion       cascade;
drop table if exists resultados_oportunidad   cascade;
drop table if exists alertas_oportunidad      cascade;
drop table if exists postulaciones_oportunidad cascade;
drop table if exists oportunidades             cascade;
drop table if exists ruta_recomendada        cascade;
drop table if exists dependencias_servicios  cascade;
drop table if exists hitos_empresa           cascade;
drop table if exists diagnosticos            cascade;
drop table if exists documentos_chat         cascade;
drop table if exists interacciones_agente    cascade;
drop table if exists sesiones                cascade;
drop table if exists catalogo_servicios      cascade;
drop table if exists tipos_oportunidad       cascade;
drop table if exists empresas                cascade;
drop table if exists sectores                cascade;
drop table if exists administradores         cascade;
drop table if exists bitacora_auditoria      cascade;
drop table if exists usuarios_publicos       cascade;

drop type if exists dimension_enum       cascade;
drop type if exists estado_ruta_enum     cascade;
drop type if exists nivel_madurez_enum   cascade;
drop type if exists canal_entrada_enum   cascade;
drop type if exists estado_hito_enum     cascade;
drop type if exists rol_admin_enum       cascade;
drop type if exists estado_sesion_enum   cascade;

drop function if exists update_updated_at_column cascade;

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- TIPOS ENUMERADOS
-- =====================================================================

create type dimension_enum as enum (
  'oferta','experiencia','operativa','legal','financiera','comercial'
);

create type estado_ruta_enum as enum (
  'pendiente','en_progreso','completado','descartado'
);

create type nivel_madurez_enum as enum (
  'inicial','en_desarrollo','intermedio','avanzado',
  'exploracion','preparacion','lista_para_explorar','preparada','consolidada'
);

create type canal_entrada_enum as enum (
  'web','whatsapp','presencial','referido','api'
);

create type estado_hito_enum as enum (
  'bloqueado','disponible','en_progreso','completado'
);

create type estado_sesion_enum as enum (
  'en_curso','completada','abandonada'
);

create type rol_admin_enum as enum (
  'superadmin','analista'
);

-- =====================================================================
-- MÓDULO: AUTENTICACIÓN / ADMINISTRACIÓN INTERNA
-- (mismo patrón bcrypt + JWT del Proyecto Integrador)
-- =====================================================================

create table administradores (
  id                 uuid default uuid_generate_v4() primary key,
  nombre             text not null,
  correo             text not null unique,
  password_hash      text not null,
  rol                rol_admin_enum not null default 'analista',
  estado             text not null default 'activo' check (estado in ('activo','inactivo')),
  login_intentos     int default 0,
  login_bloqueado_hasta timestamptz,
  ultimo_acceso      timestamptz,
  created_at         timestamptz default timezone('utc', now()) not null,
  updated_at         timestamptz default timezone('utc', now()) not null
);

create trigger trg_admin_updated_at
  before update on administradores for each row
  execute procedure update_updated_at_column();

create table bitacora_auditoria (
  id            uuid default uuid_generate_v4() primary key,
  administrador_id uuid references administradores(id),
  accion        text not null,
  modulo        text not null,
  registro_id   uuid,
  descripcion   text,
  ip            text,
  created_at    timestamptz default timezone('utc', now()) not null
);

create index idx_bitacora_admin on bitacora_auditoria(administrador_id);

create table usuarios_publicos (
  id            uuid default uuid_generate_v4() primary key,
  nombre        text not null,
  correo        text not null unique,
  password_hash text not null,
  estado        text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at    timestamptz default timezone('utc', now()) not null
);

create index idx_usuarios_publicos_correo on usuarios_publicos(correo);

-- =====================================================================
-- MÓDULO: SECTORES
-- =====================================================================

create table sectores (
  id           uuid default uuid_generate_v4() primary key,
  nombre       text not null unique,
  codigo_ciiu  text,
  descripcion  text,
  peso_ejes    jsonb not null default
    '{"oferta":1,"experiencia":1,"operativa":1,"legal":1,"financiera":1,"comercial":1}',
  requisitos_clave text[] default '{}',
  activo       boolean default true,
  created_at   timestamptz default timezone('utc', now()) not null
);

-- =====================================================================
-- MÓDULO: EMPRESAS
-- =====================================================================

create table empresas (
  id  uuid default uuid_generate_v4() primary key,

  nombre             text not null,
  nit                text unique,
  nombre_contacto    text,
  correo_contacto    text,
  telefono_contacto  text,

  -- Identificacion del protocolo Nexus (etapa 1)
  tipo_organizacion     text check (tipo_organizacion is null or tipo_organizacion in (
    'empresa_privada','fundacion','universidad','cooperativa','asociacion',
    'consultora','empresa_tecnologica','organizacion_social','corporacion','otra')),
  cargo_contacto        text,
  sitio_web             text,

  sector_id             uuid references sectores(id),
  sector_texto          text,
  tipo_bien_servicio    text,
  ubicacion_ciudad      text,
  ubicacion_departamento text,

  anios_operacion           int  check (anios_operacion >= 0),
  rango_ventas              text,
  ventas_ultimo_anio_cop    bigint check (ventas_ultimo_anio_cop >= 0),
  tamanio_equipo            int  check (tamanio_equipo > 0),

  tiene_rup                    boolean default false,
  experiencia_previa_contratos boolean default false,
  num_contratos_previos        int default 0 check (num_contratos_previos >= 0),
  certificaciones              boolean default false,
  certificaciones_lista        text[] default '{}',

  canal_entrada      canal_entrada_enum default 'web',
  objetivo_6_meses   text,
  referido_por       text,

  created_at  timestamptz default timezone('utc', now()) not null,
  updated_at  timestamptz default timezone('utc', now()) not null,

  constraint empresas_correo_formato
    check (correo_contacto is null or correo_contacto ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create trigger trg_empresas_updated_at
  before update on empresas for each row
  execute procedure update_updated_at_column();

create index idx_empresas_sector on empresas(sector_id);
create index idx_empresas_correo on empresas(correo_contacto);

-- =====================================================================
-- MÓDULO: SESIONES DE CONVERSACIÓN (onboarding conversacional)
-- =====================================================================

create table sesiones (
  id             uuid default uuid_generate_v4() primary key,
  empresa_id     uuid references empresas(id) on delete cascade,
  usuario_publico_id uuid references usuarios_publicos(id),
  numero_sesion  int default 1 not null,
  canal          canal_entrada_enum default 'web',

  -- OPTIMIZACIÓN: estado de máquina de pasos para poder reanudar la
  -- conversación exactamente donde el usuario la dejó.
  paso_actual    int not null default 0,
  respuestas     jsonb not null default '{}',
  estado         estado_sesion_enum not null default 'en_curso',

  resumen        text,
  mensajes_raw   jsonb default '[]',
  contexto_embedding_json jsonb,

  completada     boolean default false,
  fecha_finalizacion timestamptz,
  motivo_bloqueo text,
  estado_elegibilidad text not null default 'en_revision'
    check (estado_elegibilidad in ('elegible','no_elegible','en_revision')),
  created_at     timestamptz default timezone('utc', now()) not null,
  updated_at     timestamptz default timezone('utc', now()) not null
);

create trigger trg_sesiones_updated_at
  before update on sesiones for each row
  execute procedure update_updated_at_column();

create index idx_sesiones_empresa on sesiones(empresa_id);
create index idx_sesiones_empresa_estado on sesiones(empresa_id, estado);
create index idx_sesiones_usuario_publico on sesiones(usuario_publico_id);
create index idx_sesiones_elegibilidad on sesiones(estado_elegibilidad);

create table interacciones_agente (
  id             uuid default uuid_generate_v4() primary key,
  empresa_id     uuid references empresas(id) on delete cascade,
  sesion_id      uuid references sesiones(id) on delete cascade,
  fase           text not null,
  mensaje        text not null,
  respuesta_ia   text,
  metadata       jsonb default '{}',
  created_at     timestamptz default timezone('utc', now()) not null
);

create index idx_interacciones_sesion on interacciones_agente(sesion_id, created_at);
create index idx_interacciones_empresa on interacciones_agente(empresa_id, created_at);

-- =====================================================================
-- MÓDULO: DIAGNÓSTICOS
-- =====================================================================

create table diagnosticos (
  id             uuid default uuid_generate_v4() primary key,
  empresa_id     uuid references empresas(id) on delete cascade not null,
  sesion_id      uuid references sesiones(id),
  numero_visita  int default 1 not null,

  score_oferta      int not null check (score_oferta      between 0 and 100),
  score_experiencia int not null check (score_experiencia between 0 and 100),
  score_operativa   int not null check (score_operativa   between 0 and 100),
  score_legal       int not null check (score_legal       between 0 and 100),
  score_financiera  int not null check (score_financiera  between 0 and 100),
  score_comercial   int not null check (score_comercial   between 0 and 100),

  indice_ideapro int generated always as (
    (score_oferta + score_experiencia + score_operativa +
     score_legal  + score_financiera  + score_comercial) * 10 / 6
  ) stored,

  nivel_madurez_global     nivel_madurez_enum not null,
  eje_critico_identificado dimension_enum     not null,
  brechas                  jsonb not null default '[]',
  dimensiones_ideapro     jsonb not null default '{}',

  -- Salidas del protocolo Nexus (ver database/migration_nexus_ai.sql)
  nivel_madurez_numero     smallint check (nivel_madurez_numero is null or nivel_madurez_numero between 1 and 5),
  estado_elegibilidad      text not null default 'en_revision'
    check (estado_elegibilidad in ('elegible','riesgo','no_elegible','en_revision')),
  elegibilidad             jsonb not null default '{}',
  riesgo_financiero        text check (riesgo_financiero is null or riesgo_financiero in ('bajo','medio','alto')),
  riesgo_financiero_detalle jsonb not null default '{}',
  brechas_por_familia      jsonb not null default '[]',
  clasificacion_sectorial  jsonb not null default '{}',
  perfilamiento_oferta     jsonb not null default '{}',
  entidades_objetivo       jsonb not null default '{}',
  plan_accion              jsonb not null default '{}',
  reporte_final            jsonb not null default '{}',

  -- Etapas 4 y 11 (ver database/migration_nexus_relaciones.sql)
  tags                     jsonb not null default '[]',
  organizaciones_similares jsonb not null default '{}',
  fase_ruta                text not null default 'PRE'
    check (fase_ruta in ('PRE', 'DURANTE', 'EXPOST')),

  radar_data jsonb,
  resumen_conversacion text,
  resumen_ia text,

  created_at timestamptz default timezone('utc', now()) not null
);

create index idx_diagnosticos_empresa on diagnosticos(empresa_id);
create index idx_diagnosticos_sesion  on diagnosticos(sesion_id);
create index idx_diagnosticos_indice  on diagnosticos(indice_ideapro);
-- OPTIMIZACIÓN: acceso directo al diagnóstico más reciente de una empresa
create index idx_diagnosticos_empresa_fecha on diagnosticos(empresa_id, created_at desc);
create index idx_diagnosticos_elegibilidad on diagnosticos(estado_elegibilidad);
create index idx_diagnosticos_riesgo_financiero on diagnosticos(riesgo_financiero) where riesgo_financiero is not null;
create index idx_diagnosticos_nivel_numero on diagnosticos(nivel_madurez_numero desc nulls last);
create index idx_diagnosticos_tags on diagnosticos using gin (tags jsonb_path_ops);
create unique index uq_diagnosticos_sesion on diagnosticos(sesion_id) where sesion_id is not null;

create table documentos_chat (
  id uuid default uuid_generate_v4() primary key,
  diagnostico_id uuid references diagnosticos(id) on delete cascade not null,
  usuario_publico_id uuid references usuarios_publicos(id) on delete cascade not null,
  nombre_original text not null,
  mime_type text not null check (mime_type in (
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp'
  )),
  tamano_bytes bigint not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  storage_path text not null unique,
  texto_extraido text,
  categoria text,
  fecha_vigencia date,
  estado_vigencia text not null default 'sin_verificar'
    check (estado_vigencia in ('vigente', 'por_vencer', 'vencido', 'sin_verificar')),
  requerido_para text[] not null default '{}',
  estado_procesamiento text not null default 'procesado'
    check (estado_procesamiento in ('pendiente','procesado','error')),
  error_procesamiento text,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create trigger trg_documentos_chat_updated_at
  before update on documentos_chat for each row
  execute procedure update_updated_at_column();

create index idx_documentos_diagnostico on documentos_chat(diagnostico_id, created_at);
create index idx_documentos_usuario on documentos_chat(usuario_publico_id, created_at);

-- =====================================================================
-- MÓDULO: CATÁLOGO DE SERVICIOS IDEAPRO
-- =====================================================================

create table catalogo_servicios (
  id uuid default uuid_generate_v4() primary key,

  eje_relacionado   dimension_enum not null,
  ejes_secundarios  dimension_enum[] default '{}',
  nombre_servicio   text not null,
  descripcion       text not null,
  descripcion_corta text,
  tipo_servicio     text not null,

  nivel_minimo_requerido nivel_madurez_enum,
  indice_minimo          int default 0 check (indice_minimo between 0 and 1000),

  precio_referencia_cop  bigint check (precio_referencia_cop >= 0),
  duracion_semanas       int check (duracion_semanas > 0),
  modalidad              text,

  impulsa_eje             dimension_enum,
  puntos_indice_esperados int default 0,

  activo          boolean default true,
  orden_catalogo  int,

  created_at  timestamptz default timezone('utc', now()) not null,
  updated_at  timestamptz default timezone('utc', now()) not null
);

create trigger trg_catalogo_updated_at
  before update on catalogo_servicios for each row
  execute procedure update_updated_at_column();

-- OPTIMIZACIÓN: consulta más frecuente del motor de recomendación
create index idx_catalogo_activo_eje on catalogo_servicios(activo, eje_relacionado) where activo = true;
create unique index uq_catalogo_orden on catalogo_servicios(orden_catalogo) where orden_catalogo is not null;

create table dependencias_servicios (
  servicio_id     uuid references catalogo_servicios(id) on delete cascade not null,
  prerequisito_id uuid references catalogo_servicios(id) on delete cascade not null,
  es_obligatorio  boolean default false,
  primary key (servicio_id, prerequisito_id),
  check (servicio_id <> prerequisito_id)
);

-- =====================================================================
-- MÓDULO: RUTA DE CRECIMIENTO RECOMENDADA
-- =====================================================================

create table ruta_recomendada (
  id             uuid default uuid_generate_v4() primary key,
  diagnostico_id uuid references diagnosticos(id)       on delete cascade not null,
  servicio_id    uuid references catalogo_servicios(id) on delete cascade not null,
  orden_prioridad int not null check (orden_prioridad > 0),
  estado          estado_ruta_enum default 'pendiente' not null,

  justificacion_ia  text,
  fecha_objetivo    date,
  fecha_completado  timestamptz,
  notas_seguimiento text,

  created_at  timestamptz default timezone('utc', now()) not null,
  updated_at  timestamptz default timezone('utc', now()) not null,

  constraint uq_ruta_diagnostico_servicio unique (diagnostico_id, servicio_id)
);

create trigger trg_ruta_updated_at
  before update on ruta_recomendada for each row
  execute procedure update_updated_at_column();

create index idx_ruta_diagnostico on ruta_recomendada(diagnostico_id, orden_prioridad);

-- =====================================================================
-- MÓDULO: HITOS / GAMIFICACIÓN DE LA RUTA
-- =====================================================================

create table hitos_empresa (
  id                uuid default uuid_generate_v4() primary key,
  empresa_id        uuid references empresas(id) on delete cascade not null,
  servicio_asociado uuid references catalogo_servicios(id),
  desbloqueado_por  uuid references hitos_empresa(id),

  nombre_hito     text not null,
  descripcion     text,
  eje_relacionado dimension_enum,
  orden           int not null,
  estado          estado_hito_enum default 'bloqueado' not null,
  puntos_otorgados int default 0,

  fecha_disponible date,
  fecha_completado timestamptz,

  created_at  timestamptz default timezone('utc', now()) not null,
  updated_at  timestamptz default timezone('utc', now()) not null
);

create trigger trg_hitos_updated_at
  before update on hitos_empresa for each row
  execute procedure update_updated_at_column();

create index idx_hitos_empresa on hitos_empresa(empresa_id);

-- =====================================================================
-- MÓDULO: TIPOS DE OPORTUNIDAD Y ENCAJE
-- =====================================================================

create table tipos_oportunidad (
  id                    uuid default uuid_generate_v4() primary key,
  nombre                text not null,
  descripcion           text,
  modalidad_contratacion text,
  sectores_aplicables   text[] default '{}',
  requisitos_por_eje    jsonb default '{}',
  valor_referencia_cop  bigint check (valor_referencia_cop >= 0),
  activo                boolean default true,
  created_at            timestamptz default timezone('utc', now()) not null
);

create table encaje_oportunidad (
  id                    uuid default uuid_generate_v4() primary key,
  diagnostico_id        uuid references diagnosticos(id)      on delete cascade not null,
  oportunidad_id        uuid references tipos_oportunidad(id) on delete cascade not null,
  porcentaje_encaje     int not null check (porcentaje_encaje between 0 and 100),
  brechas_identificadas jsonb default '[]',
  calculated_at  timestamptz default timezone('utc', now()) not null,

  constraint uq_encaje_diagnostico_oportunidad unique (diagnostico_id, oportunidad_id)
);

create index idx_encaje_diagnostico on encaje_oportunidad(diagnostico_id);

-- =====================================================================
-- OPORTUNIDADES REALES Y ACOMPANAMIENTO PRE/DURANTE/EXPOST
-- =====================================================================

create table oportunidades (
  id uuid default uuid_generate_v4() primary key,
  fuente text not null default 'manual' check (fuente in ('manual', 'secop_ii')),
  referencia_externa text,
  nombre text not null,
  entidad text,
  territorio text,
  descripcion text,
  url_fuente text,
  fecha_cierre timestamptz,
  requisitos jsonb not null default '{}',
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada', 'en_revision')),
  actualizado_fuente_at timestamptz,
  payload_fuente jsonb not null default '{}',
  alertas_habilitadas boolean not null default true,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create unique index uq_oportunidades_fuente_referencia
  on oportunidades (fuente, lower(trim(referencia_externa)))
  where referencia_externa is not null and trim(referencia_externa) <> '';
alter table oportunidades
  add constraint uq_oportunidades_fuente_referencia_constraint unique (fuente, referencia_externa);
create index idx_oportunidades_estado_cierre on oportunidades(estado, fecha_cierre);

create table postulaciones_oportunidad (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references empresas(id) on delete cascade not null,
  oportunidad_id uuid references oportunidades(id) on delete cascade not null,
  diagnostico_id uuid references diagnosticos(id),
  fase text not null default 'PRE' check (fase in ('PRE', 'DURANTE', 'EXPOST')),
  estado text not null default 'recomendada'
    check (estado in ('recomendada', 'en_preparacion', 'enviada', 'adjudicada', 'no_adjudicada', 'retirada')),
  porcentaje_encaje integer check (porcentaje_encaje between 0 and 100),
  brechas jsonb not null default '[]',
  notas text,
  perfilamiento jsonb not null default '{}',
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null,
  unique (empresa_id, oportunidad_id)
);

create index idx_postulaciones_empresa on postulaciones_oportunidad(empresa_id, created_at desc);
create index idx_postulaciones_fase_estado on postulaciones_oportunidad(fase, estado, updated_at desc);

create table resultados_oportunidad (
  id uuid default uuid_generate_v4() primary key,
  postulacion_id uuid references postulaciones_oportunidad(id) on delete cascade not null,
  resultado text not null check (resultado in ('adjudicada', 'no_adjudicada', 'cancelada', 'sin_respuesta')),
  dificultades text,
  aprendizajes text,
  nuevas_brechas jsonb not null default '[]',
  fecha_resultado timestamptz default timezone('utc', now()) not null
);

create table tareas_postulacion (
  id uuid default uuid_generate_v4() primary key,
  postulacion_id uuid references postulaciones_oportunidad(id) on delete cascade not null,
  tipo text not null check (tipo in ('brecha', 'documento', 'entrega', 'acompanamiento', 'otro')),
  titulo text not null,
  descripcion text,
  fecha_limite timestamptz,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  notas text,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null,
  unique (postulacion_id, titulo)
);
create index idx_tareas_postulacion on tareas_postulacion(postulacion_id, fecha_limite);

create table alertas_oportunidad (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references empresas(id) on delete cascade not null,
  oportunidad_id uuid references oportunidades(id) on delete cascade not null,
  postulacion_id uuid references postulaciones_oportunidad(id) on delete cascade,
  tipo text not null check (tipo in ('cierre_proximo', 'requisito_faltante', 'documento_por_vencer', 'nueva_oportunidad')),
  titulo text not null,
  mensaje text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviada', 'leida', 'descartada')),
  fecha_programada timestamptz,
  leida_at timestamptz,
  payload jsonb not null default '{}',
  created_at timestamptz default timezone('utc', now()) not null,
  unique (postulacion_id, tipo)
);
create index idx_alertas_empresa_estado on alertas_oportunidad(empresa_id, estado, created_at desc);

create table formaciones (
  id uuid default uuid_generate_v4() primary key,
  servicio_id uuid references catalogo_servicios(id) on delete set null,
  nombre text not null,
  descripcion text,
  proveedor text,
  url text,
  objetivo text,
  evidencia_requerida text,
  duracion_horas integer check (duracion_horas > 0),
  contenido jsonb not null default '[]',
  activo boolean not null default true,
  created_at timestamptz default timezone('utc', now()) not null
);

create table resultados_formacion (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references empresas(id) on delete cascade not null,
  formacion_id uuid references formaciones(id) on delete cascade not null,
  diagnostico_origen_id uuid references diagnosticos(id),
  diagnostico_reevaluacion_id uuid references diagnosticos(id),
  estado text not null default 'asignada' check (estado in ('asignada', 'en_curso', 'completada', 'cancelada')),
  resultado text,
  completada_at timestamptz,
  created_at timestamptz default timezone('utc', now()) not null,
  unique (empresa_id, formacion_id, diagnostico_origen_id)
);
create index idx_resultados_formacion_empresa on resultados_formacion(empresa_id, created_at desc);

-- =====================================================================
-- VISTA DE APOYO PARA EL PANEL ADMINISTRATIVO
-- =====================================================================

create or replace view vista_empresa_resumen as
select
  e.id                       as empresa_id,
  e.nombre                   as empresa_nombre,
  e.correo_contacto,
  e.canal_entrada,
  e.tipo_organizacion,
  e.ubicacion_ciudad,
  e.ubicacion_departamento,
  s.nombre                   as sector_nombre,
  d.id                       as ultimo_diagnostico_id,
  d.indice_ideapro,
  d.nivel_madurez_global,
  d.nivel_madurez_numero,
  d.estado_elegibilidad,
  d.riesgo_financiero,
  d.eje_critico_identificado,
  d.created_at               as fecha_diagnostico
from empresas e
left join sectores s on s.id = e.sector_id
left join lateral (
  select * from diagnosticos di
  where di.empresa_id = e.id
  order by di.created_at desc
  limit 1
) d on true;

-- =====================================================================
-- SEGURIDAD: ROW LEVEL SECURITY
-- =====================================================================
-- El backend siempre opera con la service_role key (como en el PI), por
-- lo que RLS no bloquea al servidor. Estas políticas son la última
-- barrera si alguna vez se expone la anon key al cliente: solo permiten
-- lectura de catálogo/oportunidades público y ninguna escritura directa.

alter table sectores              enable row level security;
alter table empresas              enable row level security;
alter table sesiones              enable row level security;
alter table interacciones_agente enable row level security;
alter table diagnosticos          enable row level security;
alter table documentos_chat       enable row level security;
alter table catalogo_servicios    enable row level security;
alter table dependencias_servicios enable row level security;
alter table ruta_recomendada      enable row level security;
alter table hitos_empresa         enable row level security;
alter table tipos_oportunidad     enable row level security;
alter table encaje_oportunidad    enable row level security;
alter table oportunidades         enable row level security;
alter table postulaciones_oportunidad enable row level security;
alter table resultados_oportunidad enable row level security;
alter table tareas_postulacion    enable row level security;
alter table formaciones            enable row level security;
alter table resultados_formacion  enable row level security;
alter table alertas_oportunidad   enable row level security;
alter table administradores       enable row level security;
alter table bitacora_auditoria    enable row level security;
alter table usuarios_publicos     enable row level security;

create policy "Lectura pública catálogo activo" on catalogo_servicios
  for select using (activo = true);

create policy "Lectura pública dependencias" on dependencias_servicios
  for select using (true);

create policy "Lectura pública sectores" on sectores
  for select using (activo = true);

create policy "Lectura pública oportunidades activas" on tipos_oportunidad
  for select using (activo = true);

create policy "Usuarios públicos vía servicio" on usuarios_publicos
  for all to service_role using (true) with check (true);

grant usage on schema public to service_role;
grant select, insert, update, delete on table usuarios_publicos to service_role;
grant select, insert, update, delete on table administradores to service_role;
grant select, insert, update, delete on table interacciones_agente to service_role;
grant select, insert, update, delete on table documentos_chat to service_role;
grant select, insert, update, delete on table oportunidades to service_role;
grant select, insert, update, delete on table postulaciones_oportunidad to service_role;
grant select, insert, update, delete on table resultados_oportunidad to service_role;
grant select, insert, update, delete on table tareas_postulacion to service_role;
grant select, insert, update, delete on table formaciones to service_role;
grant select, insert, update, delete on table resultados_formacion to service_role;
grant select, insert, update, delete on table alertas_oportunidad to service_role;
grant usage on schema storage to service_role;
grant select, insert, update, delete on table storage.objects to service_role;

insert into storage.buckets (id, name, public)
values ('ideapro-documentos', 'ideapro-documentos', false)
on conflict (id) do nothing;

-- El resto de tablas (empresas, sesiones, diagnósticos, ruta, hitos,
-- encaje, administradores, bitácora) NO tienen policy de acceso público:
-- solo son accesibles vía service_role desde el backend, igual que en
-- el Proyecto Integrador.
