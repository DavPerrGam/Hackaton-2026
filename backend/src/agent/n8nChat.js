import { env } from '../config/env.js';
import { IDENTIDAD_NEXUS } from './nexusPrompt.js';

export const PARAMETROS_ANTI_INVENCIÓN = Object.freeze({
  confianza_minima: 0.65,
  no_inventar_datos: true,
  no_asumir_respuestas: true,
  exigir_evidencia_en_contexto: true,
  si_no_hay_evidencia: 'pedir_aclaracion',
});

export const RUBRICA_ASESORAMIENTO = Object.freeze([
  'Responder únicamente con base en la entrevista, el diagnóstico y las fuentes incluidas en el contexto recibido.',
  'Usar solo información que la empresa haya entregado o que exista en los datos calculados por IDEAPRO.',
  'Explicar el porqué usando nivel de madurez, scores, dimensiones, radar y brechas.',
  'Conectar cada recomendación con la ruta, servicios, entidades y oportunidades recibidas.',
  'Proponer acciones solo desde plan_accion y datos existentes; no crear plazos ni requisitos.',
  'Distinguir hechos, interpretación profesional y dato faltante.',
  'Si el estado de elegibilidad es riesgo o no_elegible, mencionarlo antes de recomendar competir.',
  'Si la solicitud no está respaldada por la entrevista, el diagnóstico, los documentos o las oportunidades recibidas, decir: "Ese dato no está disponible en la base consultada".',
  'Cuando falte información, explicar qué dato se necesita, por qué es necesario y cómo puede aportarlo la empresa.',
  'Si piden información externa no disponible, ofrecer únicamente orientación general claramente marcada como referencia, nunca como hecho confirmado.',
  'No responder temas ajenos al asesoramiento empresarial; pedir que reformulen la solicitud.',
  'No recalcular índices, madurez, elegibilidad, brechas ni prioridades.',
]);

export function esConfianzaValida(confianza) {
  return typeof confianza === 'number'
    && Number.isFinite(confianza)
    && confianza >= 0
    && confianza <= 1;
}

export function esRespuestaConfiable(respuesta) {
  return Boolean(
    respuesta
    && typeof respuesta.reply === 'string'
    && respuesta.reply.trim().length >= 3
    && esConfianzaValida(respuesta.confidence)
    && respuesta.confidence >= PARAMETROS_ANTI_INVENCIÓN.confianza_minima
  );
}

export function respuestaTieneEvidenciaNumerica(reply, contexto) {
  const numeros = String(reply || '').match(/\b\d+(?:[.,]\d+)?\b/g) || [];
  if (numeros.length === 0) return true;
  const contextoTexto = JSON.stringify(contexto || {}).replace(',', '.');
  return numeros.every((numero) => contextoTexto.includes(numero.replace(',', '.')));
}

function unwrap(payload) {
  if (Array.isArray(payload)) return unwrap(payload[0]);
  if (payload?.json && typeof payload.json === 'object') return payload.json;
  return payload && typeof payload === 'object' ? payload : null;
}

function textoRespuesta(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    return String(value.reply || value.output || value.text || value.message || '').trim();
  }
  return '';
}

export async function interpretarMensaje(contexto) {
  if (!env.n8nChatWebhookUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.n8nTimeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (env.n8nWebhookSecret) headers['X-N8N-Secret'] = env.n8nWebhookSecret;

    const response = await fetch(env.n8nChatWebhookUrl, {
      method: 'POST',
      headers,
      // La identidad viaja en el payload para que el flujo de n8n use
      // exactamente el mismo consultor que el backend, sin tener que
      // mantener el prompt duplicado dentro de n8n Cloud (que no se
      // puede versionar desde este repositorio).
      body: JSON.stringify({
        ...contexto,
        system_prompt: IDENTIDAD_NEXUS,
        parametros_control: PARAMETROS_ANTI_INVENCIÓN,
        rubrica_asesoramiento: RUBRICA_ASESORAMIENTO,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`n8n respondió ${response.status}`);

    const raw = (response.headers.get('content-type') || '').includes('application/json')
      ? await response.json()
      : await response.text();
    const data = unwrap(raw);

    const reply = textoRespuesta(data?.reply);
    if (!reply || reply === '[object Object]') {
      throw new Error('La respuesta de n8n no contiene un reply de texto válido');
    }

    const nextAction = ['save_answer', 'ask_clarification', 'finish'].includes(data.next_action)
      ? data.next_action
      : 'ask_clarification';

    return {
      reply,
      next_action: nextAction,
      value: data.value,
      confidence: esConfianzaValida(data?.confidence) ? data.confidence : 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}