import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_INTENTOS = 3;
const BLOQUEO_MS = 10_000;

export async function login(correo, password) {
  const correoNormalizado = correo.trim().toLowerCase();
  const { data: admin, error } = await supabaseAdmin
    .from('administradores')
    .select('*')
    .eq('correo', correoNormalizado)
    .maybeSingle();

  if (error) throw new ApiError(500, 'Error consultando el administrador', error.message);
  if (!admin) throw new ApiError(401, 'Credenciales inválidas');

  if (admin.login_bloqueado_hasta && new Date(admin.login_bloqueado_hasta) > new Date()) {
    const segundos = Math.ceil((new Date(admin.login_bloqueado_hasta) - new Date()) / 1000);
    throw new ApiError(423, `Cuenta bloqueada temporalmente. Intenta en ${segundos} segundos`);
  }

  const valido = await bcrypt.compare(password, admin.password_hash);

  if (!valido) {
    const intentos = (admin.login_intentos || 0) + 1;
    const bloqueado = intentos >= MAX_INTENTOS;
    await supabaseAdmin
      .from('administradores')
      .update({
        login_intentos: bloqueado ? 0 : intentos,
        login_bloqueado_hasta: bloqueado ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null,
      })
      .eq('id', admin.id);
    throw new ApiError(401, 'Credenciales inválidas');
  }

  if (admin.estado !== 'activo') {
    throw new ApiError(403, 'Esta cuenta está inactiva');
  }

  await supabaseAdmin
    .from('administradores')
    .update({ login_intentos: 0, login_bloqueado_hasta: null, ultimo_acceso: new Date().toISOString() })
    .eq('id', admin.id);

  const token = jwt.sign({ sub: admin.id, correo: admin.correo, rol: admin.rol }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  return {
    token,
    admin: { id: admin.id, nombre: admin.nombre, correo: admin.correo, rol: admin.rol },
  };
}

export async function crearAdministrador({ nombre, correo, password, rol = 'analista' }) {
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabaseAdmin
    .from('administradores')
    .insert({ nombre, correo: correo.trim().toLowerCase(), password_hash, rol })
    .select('id, nombre, correo, rol')
    .single();
  if (error?.code === '23505') throw new ApiError(409, 'Ya existe una cuenta con ese correo');
  if (error) throw new ApiError(500, 'No se pudo crear el administrador', error.message);
  return data;
}

export async function registrarUsuarioPublico({ nombre, correo, password }) {
  if (!nombre?.trim() || !correo?.trim() || !password) {
    throw new ApiError(400, 'Nombre, correo y contraseña son obligatorios');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabaseAdmin
    .from('usuarios_publicos')
    .insert({ nombre: nombre.trim(), correo: correo.trim().toLowerCase(), password_hash })
    .select('id, nombre, correo, estado, created_at')
    .single();

  if (error?.code === '23505') throw new ApiError(409, 'Ya existe un registro con ese correo');
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    throw new ApiError(500, 'Falta crear la tabla usuarios_publicos en Supabase. Ejecuta database/migration_public_users.sql.');
  }
  if (error) throw new ApiError(500, 'No se pudo crear el registro público', error.message);
  const token = jwt.sign(
    { sub: data.id, correo: data.correo, tipo: 'usuario_publico' },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return { usuario: data, token };
}

export async function loginUsuarioPublico(correo, password) {
  const { data: usuario, error } = await supabaseAdmin
    .from('usuarios_publicos')
    .select('*')
    .eq('correo', correo.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new ApiError(500, 'Error consultando el registro público', error.message);
  if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
    throw new ApiError(401, 'Correo o contraseña inválidos');
  }
  if (usuario.estado !== 'activo') throw new ApiError(403, 'Esta cuenta está inactiva');

  const token = jwt.sign(
    { sub: usuario.id, correo: usuario.correo, tipo: 'usuario_publico' },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, estado: usuario.estado },
  };
}
