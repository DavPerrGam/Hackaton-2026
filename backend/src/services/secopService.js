import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function primerValor(registro, nombres) {
  return nombres.map((nombre) => registro?.[nombre]).find((valor) => valor !== undefined && valor !== null && valor !== '');
}

function normalizarOportunidad(registro) {
  const referencia = primerValor(registro, [
    'referencia_externa', 'referencia', 'codigo_proceso', 'numero_proceso', 'id_proceso', 'id',
  ]);
  const nombre = primerValor(registro, [
    'nombre', 'titulo', 'objeto_del_contrato', 'descripcion_proceso', 'objeto',
  ]);
  if (!referencia || !nombre) return null;

  const fechaCierre = primerValor(registro, ['fecha_cierre', 'fecha_de_cierre', 'fecha_limite']);
  const fechaValida = fechaCierre && !Number.isNaN(new Date(fechaCierre).getTime())
    ? new Date(fechaCierre).toISOString()
    : null;
  const estadoFuente = String(primerValor(registro, ['estado', 'estado_proceso']) || '').toLowerCase();
  const estado = ['abierta', 'cerrada', 'en_revision'].includes(estadoFuente) ? estadoFuente : 'en_revision';

  return {
    fuente: 'secop_ii',
    referencia_externa: String(referencia).trim(),
    nombre: String(nombre).trim(),
    entidad: primerValor(registro, ['entidad', 'nombre_entidad', 'entidad_compradora']) || null,
    territorio: primerValor(registro, ['territorio', 'departamento', 'municipio', 'ciudad']) || null,
    descripcion: primerValor(registro, ['descripcion', 'descripcion_proceso', 'objeto_del_contrato']) || null,
    url_fuente: primerValor(registro, ['url_fuente', 'url', 'enlace']) || null,
    fecha_cierre: fechaValida,
    requisitos: registro.requisitos && typeof registro.requisitos === 'object' ? registro.requisitos : {},
    estado,
    actualizado_fuente_at: new Date().toISOString(),
    payload_fuente: registro,
  };
}

function extraerRegistros(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.results || payload?.data || payload?.items || payload?.records || [];
}

export async function sincronizarOportunidadesSecop({ limite = 100 } = {}) {
  if (!env.secopApiUrl) {
    throw new ApiError(503, 'La integración SECOP II no está configurada. Define SECOP_API_URL.');
  }

  let url;
  try {
    url = new URL(env.secopApiUrl);
  } catch {
    throw new ApiError(500, 'SECOP_API_URL no es una URL válida');
  }
  url.searchParams.set('$limit', String(Math.min(Math.max(Number(limite) || 100, 1), 1000)));
  const headers = { Accept: 'application/json' };
  if (env.secopApiToken) headers.Authorization = `Bearer ${env.secopApiToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.secopTimeoutMs);
  let response;
  try {
    response = await fetch(url, { headers, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError(504, 'La fuente SECOP II superó el tiempo de espera');
    throw new ApiError(502, 'No fue posible consultar la fuente SECOP II');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new ApiError(502, `La fuente SECOP II respondió ${response.status}`);

  const registros = extraerRegistros(await response.json());
  const oportunidades = registros.map(normalizarOportunidad).filter(Boolean);
  if (!oportunidades.length) return { recibidas: registros.length, sincronizadas: 0, omitidas: registros.length };

  const { data, error } = await supabaseAdmin
    .from('oportunidades')
    .upsert(oportunidades, { onConflict: 'fuente,referencia_externa' })
    .select('id, fuente, referencia_externa, nombre, estado, fecha_cierre');
  if (error) throw new ApiError(500, 'No se pudieron guardar oportunidades SECOP II', error.message);

  return {
    recibidas: registros.length,
    sincronizadas: data?.length || 0,
    omitidas: registros.length - oportunidades.length,
  };
}
