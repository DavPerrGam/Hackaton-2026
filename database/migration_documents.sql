-- Migracion final IDEAPRO. Ejecutar una vez despues de schema.sql y seed.sql.
-- El backend usa JWT propio y service_role; no depende de Supabase Auth.

BEGIN;

alter table sesiones
  add column if not exists usuario_publico_id uuid references usuarios_publicos(id);

alter table sesiones add column if not exists fecha_finalizacion timestamptz;
alter table sesiones add column if not exists motivo_bloqueo text;
alter table sesiones add column if not exists estado_elegibilidad text default 'en_revision';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sesiones_estado_elegibilidad_check'
  ) then
    alter table sesiones add constraint sesiones_estado_elegibilidad_check
      check (estado_elegibilidad in ('elegible', 'no_elegible', 'en_revision'));
  end if;
end $$;

create index if not exists idx_sesiones_usuario_publico
  on sesiones(usuario_publico_id);
create index if not exists idx_sesiones_estado on sesiones(estado);
create index if not exists idx_sesiones_elegibilidad on sesiones(estado_elegibilidad);
create index if not exists idx_sesiones_fechas on sesiones(created_at desc, fecha_finalizacion desc);

create table if not exists documentos_chat (
  id              uuid default uuid_generate_v4() primary key,
  diagnostico_id  uuid references diagnosticos(id) on delete cascade not null,
  usuario_publico_id uuid references usuarios_publicos(id) on delete cascade not null,
  nombre_original text not null,
  mime_type       text not null,
  tamano_bytes    bigint not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  storage_path    text not null unique,
  texto_extraido  text,
  estado_procesamiento text not null default 'procesado',
  error_procesamiento text,
  created_at      timestamptz default timezone('utc', now()) not null,
  updated_at      timestamptz default timezone('utc', now()) not null,
  constraint documentos_chat_mime_check check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp'
  ))
);

alter table documentos_chat add column if not exists usuario_publico_id uuid references usuarios_publicos(id) on delete cascade;
alter table documentos_chat add column if not exists estado_procesamiento text not null default 'procesado';
alter table documentos_chat add column if not exists error_procesamiento text;
alter table documentos_chat add column if not exists updated_at timestamptz default timezone('utc', now()) not null;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_documentos_chat_updated_at') then
    create trigger trg_documentos_chat_updated_at
      before update on documentos_chat for each row
      execute procedure update_updated_at_column();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documentos_chat_estado_procesamiento_check'
  ) then
    alter table documentos_chat add constraint documentos_chat_estado_procesamiento_check
      check (estado_procesamiento in ('pendiente', 'procesado', 'error'));
  end if;
end $$;

create index if not exists idx_documentos_chat_diagnostico
  on documentos_chat(diagnostico_id, created_at);
create index if not exists idx_documentos_chat_usuario
  on documentos_chat(usuario_publico_id, created_at);

alter table documentos_chat enable row level security;
grant select, insert, update, delete on table documentos_chat to service_role;

insert into storage.buckets (id, name, public)
values ('ideapro-documentos', 'ideapro-documentos', false)
on conflict (id) do nothing;

grant select, insert, update, delete on table storage.objects to service_role;

COMMIT;