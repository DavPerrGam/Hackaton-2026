import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import { listarDocumentos } from './documentService.js';
import { interpretarMensaje, esRespuestaConfiable, respuestaTieneEvidenciaNumerica } from '../agent/n8nChat.js';
import { tablaNoDisponible } from './catalogoService.js';
import * as alertService from './alertService.js';
import { identificarOportunidadesReales } from '../agent/opportunityMatch.js';

function validarUuid(valor, nombre) {
  if (!/^[0-9a-f-]{36}$/i.test(String(valor || ''))) {
    throw new ApiError(400, `${nombre} no es válido`);
  }
}

async function obtenerDiagnosticoPropio(diagnosticoId, publicUserId) {
  validarUuid(diagnosticoId, 'El diagnóstico');
  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('*, sesiones!inner(usuario_publico_id), empresas(id, nombre, sector_texto, tipo_bien_servicio, ubicacion_ciudad, ubicacion_departamento)')
    .eq('id', diagnosticoId)
    .eq('sesiones.usuario_publico_id', publicUserId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'No se pudo verificar el diagnóstico', error.message);
  if (!data) throw new ApiError(404, 'Diagnóstico no encontrado');
  return data;
}

async function obtenerPostulacionPropia(postulacionId, publicUserId) {
  validarUuid(postulacionId, 'La postulación');
  const { data, error } = await supabaseAdmin
    .from('postulaciones_oportunidad')
    .select('*, oportunidades(*), empresas!inner(id, nombre), diagnosticos!inner(id, sesiones!inner(usuario_publico_id))')
    .eq('id', postulacionId)
    .eq('diagnosticos.sesiones.usuario_publico_id', publicUserId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'No se pudo verificar la postulación', error.message);
  if (!data) throw new ApiError(404, 'Postulación no encontrada');
  return data;
}

function errorTabla(error, entidad) {
  if (error?.code === '42P01' || error?.code === 'PGRST205' || String(error?.message || '').toLowerCase().includes('schema cache')) {
    throw new ApiError(503, `La tabla de ${entidad} no está disponible. Ejecuta database/migration_ideapro_2026.sql.`);
  }
  throw new ApiError(500, `No se pudo consultar ${entidad}`, error?.message);
}

export async function listarOportunidades({ diagnosticoId, publicUserId } = {}) {
  let diagnostico = null;
  if (diagnosticoId) diagnostico = await obtenerDiagnosticoPropio(diagnosticoId, publicUserId);

  const { data, error } = await supabaseAdmin
    .from('oportunidades')
    .select('*')
    .eq('estado', 'abierta')
    .or(`fecha_cierre.is.null,fecha_cierre.gte.${new Date().toISOString()}`)
    .order('fecha_cierre', { ascending: true, nullsFirst: false });
  if (tablaNoDisponible(error, 'oportunidades')) return [];
  if (error) errorTabla(error, 'oportunidades');

  if (!diagnostico) return data || [];
  const matches = identificarOportunidadesReales(
    { scores: {
      oferta: diagnostico.score_oferta,
      experiencia: diagnostico.score_experiencia,
      operativa: diagnostico.score_operativa,
      legal: diagnostico.score_legal,
      financiera: diagnostico.score_financiera,
      comercial: diagnostico.score_comercial,
    } },
    data || [],
    {
      sector_texto: diagnostico.empresas?.sector_texto,
      tipo_bien_servicio: diagnostico.empresas?.tipo_bien_servicio,
      territorio: diagnostico.empresas?.ubicacion_departamento || diagnostico.empresas?.ubicacion_ciudad,
    },
    diagnostico.empresas
  );
  return matches.map((match) => ({
    ...match.oportunidad,
    encaje: { porcentaje: match.porcentajeEncaje, brechas: match.brechas },
    fortalezas: match.fortalezas,
    accionRecomendada: match.accionRecomendada,
  }));
}

export async function listarOportunidadesAdmin() {
  const { data, error } = await supabaseAdmin.from('oportunidades').select('*').order('created_at', { ascending: false });
  if (error) errorTabla(error, 'oportunidades');
  return data || [];
}

export async function crearOportunidadAdmin(payload) {
  if (!String(payload.nombre || '').trim()) throw new ApiError(400, 'El nombre de la oportunidad es obligatorio');
  if (!['manual', 'secop_ii'].includes(payload.fuente || 'manual')) throw new ApiError(400, 'Fuente de oportunidad no válida');
  const { data, error } = await supabaseAdmin.from('oportunidades').insert({
    fuente: payload.fuente || 'manual',
    referencia_externa: payload.referenciaExterna || null,
    nombre: String(payload.nombre).trim(),
    entidad: payload.entidad || null,
    territorio: payload.territorio || null,
    descripcion: payload.descripcion || null,
    url_fuente: payload.urlFuente || null,
    fecha_cierre: payload.fechaCierre || null,
    requisitos: payload.requisitos && typeof payload.requisitos === 'object' ? payload.requisitos : {},
    estado: payload.estado || 'abierta',
  }).select().single();
  if (error) throw new ApiError(500, 'No se pudo registrar la oportunidad', error.message);
  return data;
}

export async function actualizarOportunidadAdmin(id, payload) {
  validarUuid(id, 'La oportunidad');
  const permitidos = {};
  for (const campo of ['nombre', 'entidad', 'territorio', 'descripcion', 'url_fuente', 'fecha_cierre', 'estado', 'requisitos']) {
    if (payload[campo] !== undefined) permitidos[campo] = payload[campo];
  }
  if (permitidos.estado && !['abierta', 'cerrada', 'en_revision'].includes(permitidos.estado)) throw new ApiError(400, 'Estado de oportunidad no válido');
  const { data, error } = await supabaseAdmin.from('oportunidades').update(permitidos).eq('id', id).select().single();
  if (error) throw new ApiError(500, 'No se pudo actualizar la oportunidad', error.message);
  return data;
}

export async function crearPostulacion({ diagnosticoId, oportunidadId, publicUserId, perfilamiento = {} }) {
  const diagnostico = await obtenerDiagnosticoPropio(diagnosticoId, publicUserId);
  validarUuid(oportunidadId, 'La oportunidad');
  const { data: oportunidad, error: oportunidadError } = await supabaseAdmin
    .from('oportunidades').select('*').eq('id', oportunidadId).eq('estado', 'abierta').maybeSingle();
  if (oportunidadError) errorTabla(oportunidadError, 'oportunidades');
  if (!oportunidad) throw new ApiError(404, 'Oportunidad no encontrada o cerrada');

  const documentos = await listarDocumentos(diagnostico.id, publicUserId);
  const match = identificarOportunidadesReales({ scores: {
    oferta: diagnostico.score_oferta,
    experiencia: diagnostico.score_experiencia,
    operativa: diagnostico.score_operativa,
    legal: diagnostico.score_legal,
    financiera: diagnostico.score_financiera,
    comercial: diagnostico.score_comercial,
  } }, [oportunidad], {
    sector_texto: diagnostico.empresas?.sector_texto,
    tipo_bien_servicio: diagnostico.empresas?.tipo_bien_servicio,
    territorio: diagnostico.empresas?.ubicacion_departamento || diagnostico.empresas?.ubicacion_ciudad,
    documentos: documentos.filter((documento) => documento.estado_vigencia !== 'vencido')
      .map((documento) => documento.categoria || documento.nombre_original),
  }, diagnostico.empresas)[0];
  if (!match) throw new ApiError(409, 'La oportunidad no es compatible con el perfil actual');
  const encaje = { porcentaje: match.porcentajeEncaje, brechas: match.brechas };
  const perfil = {
    producto: perfilamiento.producto || diagnostico.empresas?.tipo_bien_servicio || null,
    problemaPublico: perfilamiento.problemaPublico || null,
    entidad: perfilamiento.entidad || oportunidad.entidad || null,
    territorio: perfilamiento.territorio || oportunidad.territorio || diagnostico.empresas?.ubicacion_departamento || null,
  };

  const { data: postulacion, error } = await supabaseAdmin
    .from('postulaciones_oportunidad')
    .upsert({
      empresa_id: diagnostico.empresa_id,
      oportunidad_id: oportunidadId,
      diagnostico_id: diagnostico.id,
      fase: 'DURANTE',
      estado: 'en_preparacion',
      porcentaje_encaje: encaje.porcentaje,
      brechas: encaje.brechas,
      perfilamiento: perfil,
    }, { onConflict: 'empresa_id,oportunidad_id' })
    .select('*, oportunidades(*)')
    .single();
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') errorTabla(error, 'postulaciones');
    throw new ApiError(500, 'No se pudo iniciar el seguimiento de la oportunidad', error.message);
  }

  const tareas = [
    ...encaje.brechas.map((brecha) => ({
      postulacion_id: postulacion.id,
      tipo: 'brecha',
      titulo: `Cerrar brecha de ${brecha.eje}`,
      descripcion: `Alcanzar ${brecha.requerido}/100; diagnóstico actual ${brecha.real}/100.`,
      fecha_limite: oportunidad.fecha_cierre,
      estado: 'pendiente',
    })),
    { postulacion_id: postulacion.id, tipo: 'documento', titulo: 'Revisar documentos requeridos', descripcion: 'Verificar evidencia, vigencia y faltantes antes del cierre.', fecha_limite: oportunidad.fecha_cierre, estado: 'pendiente' },
    { postulacion_id: postulacion.id, tipo: 'entrega', titulo: 'Preparar y enviar la propuesta', descripcion: 'Registrar el envío y conservar la evidencia de presentación.', fecha_limite: oportunidad.fecha_cierre, estado: 'pendiente' },
  ];
  const { error: tareasError } = await supabaseAdmin.from('tareas_postulacion').upsert(tareas, { onConflict: 'postulacion_id,titulo' });
  if (tareasError) errorTabla(tareasError, 'tareas de oportunidad');
  await alertService.programarAlertasOportunidad({
    empresaId: diagnostico.empresa_id,
    oportunidad,
    postulacionId: postulacion.id,
    brechas: encaje.brechas,
  });
  return obtenerSeguimiento(postulacion.id, publicUserId);
}

export async function obtenerSeguimiento(postulacionId, publicUserId) {
  const postulacion = await obtenerPostulacionPropia(postulacionId, publicUserId);
  const [{ data: tareas, error: tareasError }, { data: resultados, error: resultadosError }] = await Promise.all([
    supabaseAdmin.from('tareas_postulacion').select('*').eq('postulacion_id', postulacionId).order('fecha_limite', { ascending: true, nullsFirst: false }),
    supabaseAdmin.from('resultados_oportunidad').select('*').eq('postulacion_id', postulacionId).order('fecha_resultado', { ascending: false }),
  ]);
  if (tareasError || resultadosError) errorTabla(tareasError || resultadosError, 'seguimiento');
  const documentos = await listarDocumentos(postulacion.diagnosticos.id, publicUserId);
  return { postulacion, tareas: tareas || [], documentos, resultados: resultados || [] };
}

export async function actualizarPostulacion(postulacionId, publicUserId, cambios) {
  await obtenerPostulacionPropia(postulacionId, publicUserId);
  const permitidos = {};
  if (['recomendada', 'en_preparacion', 'enviada', 'adjudicada', 'no_adjudicada', 'retirada'].includes(cambios.estado)) permitidos.estado = cambios.estado;
  if (typeof cambios.notas === 'string') permitidos.notas = cambios.notas.slice(0, 5000);
  if (!Object.keys(permitidos).length) throw new ApiError(400, 'No hay cambios válidos');
  const { data, error } = await supabaseAdmin.from('postulaciones_oportunidad').update(permitidos).eq('id', postulacionId).select().single();
  if (error) throw new ApiError(500, 'No se pudo actualizar el seguimiento', error.message);
  return data;
}

export async function actualizarTarea(tareaId, publicUserId, cambios) {
  validarUuid(tareaId, 'La tarea');
  const { data: tarea, error } = await supabaseAdmin.from('tareas_postulacion').select('*, postulaciones_oportunidad!inner(id)').eq('id', tareaId).maybeSingle();
  if (error || !tarea) throw new ApiError(404, 'Tarea no encontrada');
  await obtenerPostulacionPropia(tarea.postulacion_id, publicUserId);
  const permitidos = {};
  if (['pendiente', 'en_progreso', 'completada', 'bloqueada'].includes(cambios.estado)) permitidos.estado = cambios.estado;
  if (cambios.fecha_limite !== undefined) permitidos.fecha_limite = cambios.fecha_limite || null;
  if (typeof cambios.notas === 'string') permitidos.notas = cambios.notas.slice(0, 3000);
  const { data, error: updateError } = await supabaseAdmin.from('tareas_postulacion').update(permitidos).eq('id', tareaId).select().single();
  if (updateError) throw new ApiError(500, 'No se pudo actualizar la tarea', updateError.message);
  return data;
}

export async function registrarResultado(postulacionId, publicUserId, payload) {
  const postulacion = await obtenerPostulacionPropia(postulacionId, publicUserId);
  if (!['adjudicada', 'no_adjudicada', 'cancelada', 'sin_respuesta'].includes(payload.resultado)) throw new ApiError(400, 'Resultado no válido');
  const { data, error } = await supabaseAdmin.from('resultados_oportunidad').insert({
    postulacion_id: postulacion.id,
    resultado: payload.resultado,
    dificultades: String(payload.dificultades || '').slice(0, 5000) || null,
    aprendizajes: String(payload.aprendizajes || '').slice(0, 5000) || null,
    nuevas_brechas: Array.isArray(payload.nuevasBrechas) ? payload.nuevasBrechas.slice(0, 20) : [],
  }).select().single();
  if (error) throw new ApiError(500, 'No se pudo registrar el resultado', error.message);
  await supabaseAdmin.from('postulaciones_oportunidad').update({ fase: 'EXPOST', estado: payload.resultado === 'adjudicada' ? 'adjudicada' : 'no_adjudicada' }).eq('id', postulacion.id);
  const nuevasBrechas = Array.isArray(payload.nuevasBrechas) ? payload.nuevasBrechas.slice(0, 20) : [];
  if (nuevasBrechas.length) {
    const tareas = nuevasBrechas.map((brecha, indice) => ({
      postulacion_id: postulacion.id,
      tipo: 'brecha',
      titulo: `Aprendizaje EXPOST ${indice + 1}: ${String(brecha.nombre || brecha.eje || brecha).slice(0, 150)}`,
      descripcion: String(brecha.descripcion || brecha.detalle || 'Revisar esta brecha antes de una nueva postulación.').slice(0, 1000),
      estado: 'pendiente',
    }));
    const { error: tareasError } = await supabaseAdmin.from('tareas_postulacion').upsert(tareas, { onConflict: 'postulacion_id,titulo' });
    if (tareasError) errorTabla(tareasError, 'tareas EXPOST');
  }
  return { ...data, siguiente_accion: nuevasBrechas.length ? 'Revisar las tareas EXPOST antes de una nueva postulación' : 'Comparar el próximo diagnóstico con este resultado' };
}

export async function conversarSeguimiento(postulacionId, publicUserId, mensaje) {
  const seguimiento = await obtenerSeguimiento(postulacionId, publicUserId);
  const postulacion = seguimiento.postulacion;
  const { data: historial, error: historialError } = await supabaseAdmin
    .from('interacciones_agente')
    .select('fase, mensaje, respuesta_ia, created_at')
    .eq('empresa_id', postulacion.empresa_id)
    .order('created_at', { ascending: true })
    .limit(50);
  if (historialError) throw new ApiError(500, 'No se pudo cargar el historial', historialError.message);
  const contextoSeguimiento = {
    fase: 'DURANTE',
    postulacion_id: postulacion.id,
    mensaje_usuario: String(mensaje || ''),
    empresa: postulacion.empresas,
    oportunidad: postulacion.oportunidades,
    perfilamiento: postulacion.perfilamiento,
    brechas: postulacion.brechas,
    tareas: seguimiento.tareas,
    documentos: seguimiento.documentos.map((documento) => ({ nombre: documento.nombre_original, categoria: documento.categoria, vigencia: documento.estado_vigencia })),
    historial: historial || [],
  };
  let respuesta;
  try {
    respuesta = await interpretarMensaje(contextoSeguimiento);
  } catch (error) {
    console.warn('[n8nChat] fallback en DURANTE:', error.message);
  }
  const confiable = esRespuestaConfiable(respuesta)
    && respuestaTieneEvidenciaNumerica(respuesta.reply, contextoSeguimiento);
  const reply = confiable
    ? respuesta.reply
    : 'No puedo confirmar esa información con los documentos y tareas disponibles. Revisa los pendientes de esta oportunidad o formula una pregunta más concreta.';
  const { error } = await supabaseAdmin.from('interacciones_agente').insert({
    empresa_id: postulacion.empresa_id,
    sesion_id: postulacion.diagnosticos?.sesiones?.id || null,
    fase: 'DURANTE',
    mensaje: String(mensaje || ''),
    respuesta_ia: reply,
    metadata: { postulacion_id: postulacion.id, origen: confiable ? 'n8n' : 'fallback', confidence: respuesta?.confidence || 0 },
  });
  if (error) throw new ApiError(500, 'No se pudo guardar la conversación de acompañamiento', error.message);
  return { reply, confidence: confiable ? respuesta.confidence : 0 };
}
