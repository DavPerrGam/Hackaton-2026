import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';

export function tablaNoDisponible(error, nombreTabla) {
  const mensaje = String(error?.message || '').toLowerCase();
  const tabla = String(nombreTabla || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (tabla && mensaje.includes(tabla) && (mensaje.includes('schema cache') || mensaje.includes('does not exist')));
}

function tablaOportunidadesNoDisponible(error) {
  return tablaNoDisponible(error, 'oportunidades');
}

export async function listarSectores() {
  const { data, error } = await supabaseAdmin
    .from('sectores')
    .select('id, nombre, codigo_ciiu, descripcion, peso_ejes, requisitos_clave')
    .eq('activo', true)
    .order('nombre');
  if (error) throw new ApiError(500, 'No se pudieron cargar los sectores', error.message);
  return data;
}

export async function obtenerSectorPorNombre(nombre) {
  if (!nombre) return null;
  const { data, error } = await supabaseAdmin
    .from('sectores')
    .select('*')
    .eq('nombre', nombre)
    .maybeSingle();
  if (error) throw new ApiError(500, 'Error consultando el sector', error.message);
  return data;
}

export async function listarCatalogoActivo() {
  const { data, error } = await supabaseAdmin
    .from('catalogo_servicios')
    .select('*')
    .eq('activo', true)
    .order('orden_catalogo', { ascending: true });
  if (error) throw new ApiError(500, 'No se pudo cargar el catálogo de servicios', error.message);
  return data;
}

export async function listarDependencias() {
  const { data, error } = await supabaseAdmin.from('dependencias_servicios').select('*');
  if (error) throw new ApiError(500, 'No se pudieron cargar las dependencias del catálogo', error.message);
  return data;
}

export async function listarTiposOportunidad() {
  const { data, error } = await supabaseAdmin
    .from('tipos_oportunidad')
    .select('*')
    .eq('activo', true);
  if (error) throw new ApiError(500, 'No se pudieron cargar los tipos de oportunidad', error.message);
  return data;
}

export async function listarOportunidadesReales({ limite = 100 } = {}) {
  const { data, error } = await supabaseAdmin
    .from('oportunidades')
    .select('*')
    .eq('estado', 'abierta')
    .order('fecha_cierre', { ascending: true, nullsFirst: false })
    .limit(limite);
  if (tablaOportunidadesNoDisponible(error)) {
    console.warn('[oportunidades] tabla no disponible; se omiten oportunidades reales hasta aplicar la migración');
    return [];
  }
  if (error) throw new ApiError(500, 'No se pudieron cargar las oportunidades reales', error.message);
  return data;
}
