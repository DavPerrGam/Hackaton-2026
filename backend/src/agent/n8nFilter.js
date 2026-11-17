// =====================================================================
// Filtro de IA vía n8n (opcional)
// ---------------------------------------------------------------------
// El backend llama al webhook de n8n DESPUÉS de calcular el diagnóstico
// con reglas (scoring + ruta). n8n no decide el índice ni la elegibilidad:
// solo redacta / elige la mejor respuesta para la empresa.
//
// Si N8N_WEBHOOK_URL no está definida, o n8n falla, el flujo sigue con
// Anthropic o la plantilla local. Nunca se llama a n8n desde el frontend.
//
// Contrato esperado (ajusta los nodos de n8n a este JSON):
//
// POST {N8N_WEBHOOK_URL}
// Body:
// {
//   empresa: { id, nombre },
//   diagnostico: { indiceIdeapro, nivelMadurezGlobal, scores, ejeCritico },
//   ruta: [{ servicio_id, nombre, tipo, justificacion, orden_prioridad }],
//   resumenCandidato: "texto de respaldo ya generado"
// }
//
// Respuesta (cualquiera de estas formas sirve):
// { resumen: "..." }
// { text: "..." }  |  { output: "..." }  |  { message: "..." }
// { resumen: "...", servicio_ids: ["uuid", ...] }  // reordena la ruta
// [{ json: { resumen: "..." } }]                   // formato típico n8n
// =====================================================================

import { env } from '../config/env.js';
import { respuestaTieneEvidenciaNumerica, RUBRICA_ASESORAMIENTO } from './n8nChat.js';

const CONFIANZA_MINIMA_FILTRO = 0.65;
const PARAMETROS_ANTI_INVENCIÓN = Object.freeze({
  confianza_minima: CONFIANZA_MINIMA_FILTRO,
  no_inventar_datos: true,
  no_recalcular_diagnostico: true,
  exigir_evidencia_en_contexto: true,
  si_no_hay_evidencia: 'devolver_vacio',
});

function extraerObjeto(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    const primero = data[0];
    if (primero?.json && typeof primero.json === 'object') return primero.json;
    if (primero && typeof primero === 'object') return primero;
    return null;
  }
  if (typeof data === 'object') {
    if (data.json && typeof data.json === 'object' && !data.resumen && !data.text && !data.output) {
      return data.json;
    }
    return data;
  }
  return null;
}

function extraerResumen(payload) {
  if (typeof payload === 'string' && payload.trim()) {
    const texto = payload.trim();
    if (esAcuseN8n(texto)) return null;
    return texto;
  }
  const obj = extraerObjeto(payload);
  if (!obj) return null;

  const candidatos = [
    obj.resumen,
    obj.resumen_ia,
    obj.mejor_respuesta,
    obj.respuesta,
    obj.text,
    obj.output,
    obj.message,
    obj.data?.resumen,
    obj.data?.text,
  ];

  for (const valor of candidatos) {
    if (typeof valor === 'string' && valor.trim() && !esAcuseN8n(valor)) return valor.trim();
    if (valor && typeof valor === 'object') {
      const texto = extraerResumen(valor);
      if (texto) return texto;
    }
  }
  return null;
}

function esAcuseN8n(texto) {
  const t = String(texto).trim().toLowerCase();
  return t === 'workflow was started' || t === 'workflow got started';
}

function extraerServicioIds(payload) {
  const obj = extraerObjeto(payload);
  if (!obj) return [];
  const ids = obj.servicio_ids || obj.ruta_ids || obj.orden_servicios;
  if (!Array.isArray(ids)) return [];
  return ids.map(String).filter(Boolean);
}

export async function filtrarConN8n(contexto) {
  if (!env.n8nWebhookUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.n8nTimeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (env.n8nWebhookSecret) {
      headers['X-N8N-Secret'] = env.n8nWebhookSecret;
    }

    const response = await fetch(env.n8nWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fase: 'DIAGNOSTICO',
        categoria: 'DIAGNOSTICO',
        mensaje: contexto.resumenCandidato || '',
        empresa: {
          id: contexto.empresa?.id,
          nombre: contexto.empresa?.nombre,
        },
        diagnostico: {
          indiceIdeapro: contexto.diagnostico.indiceIdeapro,
          nivelMadurezGlobal: contexto.diagnostico.nivelMadurezGlobal,
          nivelMadurez: contexto.diagnostico.nivelMadurez,
          elegibilidad: contexto.diagnostico.elegibilidad,
          riesgoElegibilidad: contexto.diagnostico.elegibilidad?.riesgos || [],
          riesgoFinanciero: contexto.diagnostico.riesgoFinanciero,
          scores: contexto.diagnostico.scores,
          ejeCritico: contexto.diagnostico.ejeCritico,
          brechas: contexto.diagnostico.brechas,
          brechasPorFamilia: contexto.diagnostico.brechasPorFamilia,
          dimensionesIdeapro: contexto.diagnostico.dimensionesIdeapro,
          radarMadurez: contexto.diagnostico.radarMadurez || {},
        },
        clasificacion: contexto.clasificacion || null,
        perfilamiento: contexto.perfilamiento || null,
        entidadesObjetivo: contexto.mapaEntidades || null,
        tags: contexto.tags?.tags || [],
        organizacionesSimilares: contexto.relaciones || null,
        rubrica_asesoramiento: RUBRICA_ASESORAMIENTO,
        ruta: (contexto.ruta || []).map((item) => ({
          servicio_id: item.servicio_id,
          nombre: item.servicio?.nombre_servicio,
          tipo: item.tipo,
          justificacion: item.justificacion,
          orden_prioridad: item.orden_prioridad,
        })),
        resumenCandidato: contexto.resumenCandidato || '',
        entrevista: contexto.entrevista || {
          preguntas_realizadas: [],
          respuestas_completas: {},
        },
        parametros_control: PARAMETROS_ANTI_INVENCIÓN,
        contrato: {
          respuesta: 'JSON',
          campos: ['resumen', 'servicio_ids', 'confidence'],
          contexto_obligatorio: [
            'entrevista.preguntas_realizadas',
            'entrevista.respuestas_completas',
            'diagnostico.elegibilidad',
            'diagnostico.nivelMadurezGlobal',
            'diagnostico.brechas',
            'diagnostico.brechasPorFamilia',
          ],
          confidence: `número entre ${CONFIANZA_MINIMA_FILTRO} y 1`,
          servicio_ids: 'solo IDs presentes en ruta',
          restricciones: [
            'no recalcular índice, elegibilidad, brechas o madurez',
            'no inventar servicios, entidades, cifras ni plazos',
            'resumen en español, máximo 5 frases',
          ],
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`n8n respondió ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const raw = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    const resumen = extraerResumen(raw);
    const servicioIds = extraerServicioIds(raw);
    const objetoRespuesta = extraerObjeto(raw);
    const confidence = objetoRespuesta?.confidence;
    const confidenceValida = typeof confidence === 'number'
      && Number.isFinite(confidence)
      && confidence >= CONFIANZA_MINIMA_FILTRO
      && confidence <= 1;
    const resumenConfiable = confidenceValida
      && respuestaTieneEvidenciaNumerica(resumen, {
        diagnostico: contexto.diagnostico,
        entrevista: contexto.entrevista,
        ruta: contexto.ruta,
      })
      ? resumen
      : null;

    if (!confidenceValida || (!resumenConfiable && servicioIds.length === 0)) {
      console.warn('[n8nFilter] El webhook respondió, pero no se reconoció resumen ni servicio_ids.');
      return null;
    }

    return { resumen: resumenConfiable, servicioIds };
  } catch (err) {
    const motivo = err.name === 'AbortError' ? 'timeout' : err.message;
    console.warn('[n8nFilter] Fallback sin n8n:', motivo);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function reordenarRutaConFiltro(ruta, servicioIds) {
  if (!Array.isArray(servicioIds) || servicioIds.length === 0) return ruta;

  const porId = new Map(ruta.map((item) => [String(item.servicio_id), item]));
  const usados = new Set();
  const ordenada = [];

  for (const id of servicioIds) {
    const item = porId.get(String(id));
    if (item && !usados.has(String(id))) {
      usados.add(String(id));
      ordenada.push(item);
    }
  }

  for (const item of ruta) {
    if (!usados.has(String(item.servicio_id))) ordenada.push(item);
  }

  return ordenada.map((item, idx) => ({ ...item, orden_prioridad: idx + 1 }));
}
