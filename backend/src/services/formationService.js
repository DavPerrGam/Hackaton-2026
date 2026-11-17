import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import { tablaNoDisponible } from './catalogoService.js';

async function diagnosticoPropio(diagnosticoId, publicUserId) {
  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('id, empresa_id, sesiones!inner(usuario_publico_id)')
    .eq('id', diagnosticoId)
    .eq('sesiones.usuario_publico_id', publicUserId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'No se pudo verificar el diagnóstico', error.message);
  if (!data) throw new ApiError(404, 'Diagnóstico no encontrado');
  return data;
}

export async function listar({ diagnosticoId, publicUserId }) {
  const diagnostico = await diagnosticoPropio(diagnosticoId, publicUserId);
  const { data: ruta, error: rutaError } = await supabaseAdmin
    .from('ruta_recomendada')
    .select('servicio_id, catalogo_servicios(id, nombre_servicio, eje_relacionado)')
    .eq('diagnostico_id', diagnostico.id);
  if (rutaError) throw new ApiError(500, 'No se pudo cargar la ruta de formación', rutaError.message);
  const servicioIds = (ruta || []).map((item) => item.servicio_id);
  let consulta = supabaseAdmin.from('formaciones').select('*').eq('activo', true).order('created_at');
  if (servicioIds.length) consulta = consulta.in('servicio_id', servicioIds);
  const { data: formaciones, error } = await consulta;
  if (tablaNoDisponible(error, 'formaciones')) return { formaciones: [], progreso: [] };
  if (error) throw new ApiError(500, 'No se pudieron cargar las formaciones', error.message);
  const { data: progreso, error: progresoError } = await supabaseAdmin
    .from('resultados_formacion').select('*').eq('empresa_id', diagnostico.empresa_id).order('created_at', { ascending: false });
  if (tablaNoDisponible(progresoError, 'resultados_formacion')) return { formaciones: formaciones || [], progreso: [] };
  if (progresoError) throw new ApiError(500, 'No se pudo cargar el progreso formativo', progresoError.message);
  return { formaciones: formaciones || [], progreso: progreso || [] };
}

export async function iniciarProgreso({ formacionId, diagnosticoId, publicUserId }) {
  const diagnostico = await diagnosticoPropio(diagnosticoId, publicUserId);
  const { data: formacion, error: formacionError } = await supabaseAdmin.from('formaciones').select('id').eq('id', formacionId).eq('activo', true).maybeSingle();
  if (formacionError || !formacion) throw new ApiError(404, 'Formación no encontrada');
  const { data, error } = await supabaseAdmin.from('resultados_formacion').upsert({
    empresa_id: diagnostico.empresa_id,
    formacion_id: formacionId,
    diagnostico_origen_id: diagnosticoId,
    estado: 'asignada',
  }, { onConflict: 'empresa_id,formacion_id,diagnostico_origen_id' }).select().single();
  if (error) throw new ApiError(500, 'No se pudo iniciar la formación', error.message);
  return data;
}

export async function actualizarProgreso({ progresoId, publicUserId, estado, resultado }) {
  const { data: progreso, error } = await supabaseAdmin.from('resultados_formacion').select('*, empresas!inner(id)').eq('id', progresoId).maybeSingle();
  if (error || !progreso) throw new ApiError(404, 'Progreso formativo no encontrado');
  const { data: sesiones, error: sesionError } = await supabaseAdmin.from('sesiones').select('empresa_id').eq('empresa_id', progreso.empresa_id).eq('usuario_publico_id', publicUserId).limit(1);
  if (sesionError || !sesiones?.length) throw new ApiError(404, 'Progreso formativo no encontrado');
  if (!['asignada', 'en_curso', 'completada', 'cancelada'].includes(estado)) throw new ApiError(400, 'Estado formativo no válido');
  const cambios = { estado, resultado: typeof resultado === 'string' ? resultado.slice(0, 5000) : progreso.resultado };
  if (estado === 'completada') cambios.completada_at = new Date().toISOString();
  const { data, error: updateError } = await supabaseAdmin.from('resultados_formacion').update(cambios).eq('id', progresoId).select().single();
  if (updateError) throw new ApiError(500, 'No se pudo actualizar la formación', updateError.message);
  return data;
}

export async function vincularReevaluacion({ progresoId, diagnosticoId, publicUserId }) {
  const diagnostico = await diagnosticoPropio(diagnosticoId, publicUserId);
  const { data, error } = await supabaseAdmin.from('resultados_formacion').update({ diagnostico_reevaluacion_id: diagnostico.id }).eq('id', progresoId).eq('empresa_id', diagnostico.empresa_id).select().single();
  if (error || !data) throw new ApiError(404, 'No se pudo vincular la reevaluación');
  return data;
}
