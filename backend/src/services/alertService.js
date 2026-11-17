import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { tablaNoDisponible } from './catalogoService.js';

async function empresaDelDiagnostico(diagnosticoId, publicUserId) {
  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('id, empresa_id, sesiones!inner(usuario_publico_id)')
    .eq('id', diagnosticoId)
    .eq('sesiones.usuario_publico_id', publicUserId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'No se pudo verificar el diagnóstico', error.message);
  if (!data) throw new ApiError(404, 'Diagnóstico no encontrado');
  return data.empresa_id;
}

export async function programarAlertasOportunidad({ empresaId, oportunidad, postulacionId, brechas = [] }) {
  const alertas = [];
  const fechaCierre = oportunidad.fecha_cierre ? new Date(oportunidad.fecha_cierre) : null;
  const ahora = new Date();
  if (fechaCierre && fechaCierre > ahora) {
    alertas.push({
      tipo: 'cierre_proximo',
      titulo: 'Fecha de cierre próxima',
      mensaje: `Revisa ${oportunidad.nombre} antes de su fecha de cierre.`,
      fecha_programada: new Date(fechaCierre.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString(),
    });
  }
  if (brechas.length) {
    alertas.push({
      tipo: 'requisito_faltante',
      titulo: 'Requisitos pendientes',
      mensaje: `Hay ${brechas.length} brecha(s) que debes revisar antes de postularte.`,
      fecha_programada: ahora.toISOString(),
    });
  }
  if (!alertas.length) return [];

  const { data, error } = await supabaseAdmin
    .from('alertas_oportunidad')
    .upsert(alertas.map((alerta) => ({
      empresa_id: empresaId,
      oportunidad_id: oportunidad.id,
      postulacion_id: postulacionId,
      ...alerta,
      payload: { fecha_cierre: oportunidad.fecha_cierre, brechas },
    })), { onConflict: 'postulacion_id,tipo' })
    .select();
  if (tablaNoDisponible(error, 'alertas_oportunidad')) return [];
  if (error) throw new ApiError(500, 'No se pudieron programar las alertas', error.message);
  return data || [];
}

export async function listarAlertas({ diagnosticoId, publicUserId }) {
  const empresaId = await empresaDelDiagnostico(diagnosticoId, publicUserId);
  const { data, error } = await supabaseAdmin
    .from('alertas_oportunidad')
    .select('*, oportunidades(id, nombre, entidad, fecha_cierre, url_fuente)')
    .eq('empresa_id', empresaId)
    .neq('estado', 'descartada')
    .order('created_at', { ascending: false });
  if (tablaNoDisponible(error, 'alertas_oportunidad')) return [];
  if (error) throw new ApiError(500, 'No se pudieron cargar las alertas', error.message);
  return data || [];
}

export async function marcarLeida({ alertaId, diagnosticoId, publicUserId }) {
  const empresaId = await empresaDelDiagnostico(diagnosticoId, publicUserId);
  const { data, error } = await supabaseAdmin
    .from('alertas_oportunidad')
    .update({ estado: 'leida', leida_at: new Date().toISOString() })
    .eq('id', alertaId)
    .eq('empresa_id', empresaId)
    .select()
    .single();
  if (error) throw new ApiError(404, 'Alerta no encontrada');
  return data;
}

export async function despacharAlertasPendientes() {
  if (!env.n8nAlertasWebhookUrl) return { procesadas: 0, motivo: 'N8N_ALERTAS_WEBHOOK_URL no configurado' };
  const { data: alertas, error } = await supabaseAdmin
    .from('alertas_oportunidad')
    .select('id, tipo, titulo, mensaje, payload, empresa_id, oportunidad_id')
    .eq('estado', 'pendiente')
    .lte('fecha_programada', new Date().toISOString())
    .limit(50);
  if (tablaNoDisponible(error, 'alertas_oportunidad')) return { procesadas: 0, motivo: 'tabla no disponible' };
  if (error) throw new ApiError(500, 'No se pudieron consultar alertas pendientes', error.message);

  let procesadas = 0;
  for (const alerta of alertas || []) {
    const response = await fetch(env.n8nAlertasWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(env.n8nWebhookSecret ? { 'X-N8N-Secret': env.n8nWebhookSecret } : {}) },
      body: JSON.stringify({ fase: 'ALERTA_OPORTUNIDAD', alerta }),
    });
    if (!response.ok) continue;
    await supabaseAdmin.from('alertas_oportunidad').update({ estado: 'enviada' }).eq('id', alerta.id);
    procesadas += 1;
  }
  return { procesadas };
}
