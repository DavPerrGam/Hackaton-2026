import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import { todosLosCamposEmpresa } from '../agent/questions.js';

// Incluye los empresaField declarados dentro de preguntas compuestas
// (`form` y `multi`), no solo los de las preguntas simples.
const EMPRESA_FIELDS = todosLosCamposEmpresa();

// Solo persiste en `empresas` los campos que el flujo de preguntas
// declaró explícitamente como empresaField; todo lo demás queda en
// sesiones.respuestas. Esto evita que un payload arbitrario escriba
// columnas no previstas (mass-assignment).
export function filtrarCamposEmpresa(respuestas) {
  const payload = {};
  for (const [key, value] of Object.entries(respuestas)) {
    if (EMPRESA_FIELDS.has(key) && value !== undefined && value !== '') {
      payload[key] = value;
    }
  }
  return payload;
}

export async function crearEmpresaBorrador() {
  const { data, error } = await supabaseAdmin
    .from('empresas')
    .insert({ nombre: 'Empresa sin nombre (en diagnóstico)' })
    .select()
    .single();
  if (error) throw new ApiError(500, 'No se pudo iniciar el registro de la empresa', error.message);
  return data;
}

// PostgREST responde "Could not find the 'X' column of 'empresas' in the
// schema cache" cuando la base todavía no tiene aplicada una migración.
// Devolvemos el nombre de la columna para poder descartarla y reintentar.
function columnaInexistente(error, tabla) {
  const coincidencia = String(error?.message || '')
    .match(new RegExp(`could not find the '([^']+)' column of '${tabla}'`, 'i'));
  return coincidencia?.[1] || null;
}

export async function actualizarEmpresa(empresaId, cambios) {
  if (Object.keys(cambios).length === 0) return null;

  // Degradación controlada: si la migración del protocolo Nexus aún no
  // se ejecutó, las columnas nuevas (tipo_organizacion, cargo_contacto,
  // sitio_web) no existen. En vez de tumbar la conversación con un 500,
  // se descarta la columna ausente y se guarda el resto: la respuesta
  // igual queda en sesiones.respuestas y alimenta el diagnóstico.
  let payload = { ...cambios };
  const omitidas = [];

  for (let intento = 0; intento <= Object.keys(cambios).length; intento += 1) {
    if (Object.keys(payload).length === 0) break;

    const { data, error } = await supabaseAdmin
      .from('empresas')
      .update(payload)
      .eq('id', empresaId)
      .select()
      .single();

    if (!error) {
      if (omitidas.length > 0) {
        console.warn(`[empresas] columnas no disponibles en la base, omitidas: ${omitidas.join(', ')}. Ejecuta database/migration_nexus_ai.sql.`);
      }
      return data;
    }

    const columna = columnaInexistente(error, 'empresas');
    if (!columna || !(columna in payload)) {
      throw new ApiError(500, 'No se pudo actualizar la información de la empresa', error.message);
    }
    omitidas.push(columna);
    delete payload[columna];
  }

  console.warn(`[empresas] ninguna columna disponible para persistir (${omitidas.join(', ')}). Ejecuta database/migration_nexus_ai.sql.`);
  return null;
}

export async function obtenerEmpresa(empresaId) {
  const { data, error } = await supabaseAdmin.from('empresas').select('*').eq('id', empresaId).maybeSingle();
  if (error) throw new ApiError(500, 'Error consultando la empresa', error.message);
  if (!data) throw new ApiError(404, 'Empresa no encontrada');
  return data;
}

export async function listarEmpresas({ limit = 50, offset = 0 } = {}) {
  const { data, error, count } = await supabaseAdmin
    .from('vista_empresa_resumen')
    .select('*', { count: 'exact' })
    .order('fecha_diagnostico', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw new ApiError(500, 'No se pudo listar las empresas', error.message);
  return { data, total: count };
}
