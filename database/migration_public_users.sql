-- Ejecutar una vez sobre una base ya existente.
create table if not exists usuarios_publicos (
  id            uuid default gen_random_uuid() primary key,
  nombre        text not null,
  correo        text not null unique,
  password_hash text not null,
  estado        text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at    timestamptz default now() not null
);

create index if not exists idx_usuarios_publicos_correo
  on usuarios_publicos(correo);

alter table usuarios_publicos enable row level security;

drop policy if exists "Usuarios públicos vía servicio" on usuarios_publicos;
create policy "Usuarios públicos vía servicio"
  on usuarios_publicos for all to service_role
  using (true) with check (true);

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.usuarios_publicos to service_role;
grant select, insert, update, delete on table public.administradores to service_role;