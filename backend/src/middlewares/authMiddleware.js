import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { supabaseAdmin } from '../config/supabase.js';

// Protege rutas del panel administrativo interno.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Token no proporcionado'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.tipo === 'usuario_publico') {
      return next(new ApiError(403, 'Se requiere una cuenta de analista'));
    }
    if (!['superadmin', 'analista'].includes(payload.rol)) {
      return next(new ApiError(403, 'El token no tiene un rol administrativo válido'));
    }
    const { data: admin, error } = await supabaseAdmin
      .from('administradores')
      .select('id, estado, rol')
      .eq('id', payload.sub)
      .maybeSingle();
    if (error || !admin || admin.estado !== 'activo' || admin.rol !== payload.rol) {
      return next(new ApiError(401, 'La sesión administrativa ya no es válida'));
    }
    req.admin = payload;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(401, 'Token inválido o expirado'));
  }
}

export function requirePublicUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Debes registrarte o iniciar sesión para continuar'));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.tipo !== 'usuario_publico') {
      return next(new ApiError(403, 'Se requiere una cuenta pública'));
    }
    supabaseAdmin
      .from('usuarios_publicos')
      .select('id, estado')
      .eq('id', payload.sub)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data || data.estado !== 'activo') {
          return next(new ApiError(401, 'Tu sesión pública ya no es válida'));
        }
        req.publicUser = payload;
        next();
      })
      .catch(() => next(new ApiError(401, 'Tu sesión pública ya no es válida')));
  } catch {
    next(new ApiError(401, 'Tu sesión pública es inválida o expiró'));
  }
}

export function requireAdminRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.rol)) {
      return next(new ApiError(403, 'No tienes permisos para esta operación'));
    }
    next();
  };
}

