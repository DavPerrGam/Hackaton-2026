// =====================================================================
// Filtro de IA: elige / redacta la mejor respuesta para la empresa
// ---------------------------------------------------------------------
// Dónde corre: SOLO al cerrar el diagnóstico (agentService.generarDiagnostico),
// no en cada pregunta del chat. El índice y la ruta salen de reglas;
// este módulo solo mejora el texto (resumen_ia) y puede reordenar
// servicios ya elegibles.
//
// Orden: n8n (si el webhook responde) → Gemini (GEMINI_API_KEY) →
// el borrador local. n8n Cloud no se puede editar desde este repo.
// =====================================================================

import { env } from '../config/env.js';
import { filtrarConN8n } from './n8nFilter.js';

function extraerJson(texto) {
  if (!texto) return null;
  const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const match = limpio.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function filtrarConGemini({ empresa, diagnostico, ruta, resumenCandidato, clasificacion, perfilamiento, mapaEntidades, tags, relaciones }) {
  if (!env.geminiApiKey) return null;

  const idsPermitidos = (ruta || []).map((item) => String(item.servicio_id));
  const prompt =
    `Eres el filtro de respuestas del agente IDEAPRO (Colombia, mercado público).\n` +
    `Tu trabajo: a partir de datos YA calculados, devolver la mejor redacción para la empresa.\n` +
    `Reglas: no inventes cifras ni servicios; máximo 4 frases; tono profesional y cercano; español.\n` +
    `Si reordenas servicios, usa SOLO estos ids: ${JSON.stringify(idsPermitidos)}\n\n` +
    `Empresa: ${empresa?.nombre || 'N/A'}\n` +
    `Índice IDEAPRO: ${diagnostico.indiceIdeapro}/1000\n` +
    `Nivel: ${diagnostico.nivelMadurezGlobal}\n` +
    `Scores: ${JSON.stringify(diagnostico.scores)}\n` +
    `Elegibilidad: ${JSON.stringify(diagnostico.elegibilidad)}\n` +
    `Riesgo financiero: ${JSON.stringify(diagnostico.riesgoFinanciero)}\n` +
    `Brechas por familia: ${JSON.stringify(diagnostico.brechasPorFamilia)}\n` +
    `Clasificación: ${JSON.stringify(clasificacion)}\n` +
    `Perfilamiento: ${JSON.stringify(perfilamiento)}\n` +
    `Entidades objetivo: ${JSON.stringify(mapaEntidades)}\n` +
    `Tags: ${JSON.stringify(tags?.tags || [])}\n` +
    `Relaciones: ${JSON.stringify(relaciones)}\n` +
    `Eje crítico: ${diagnostico.ejeCritico}\n` +
    `Ruta: ${JSON.stringify(
      (ruta || []).map((item) => ({
        servicio_id: item.servicio_id,
        nombre: item.servicio?.nombre_servicio,
        tipo: item.tipo,
      }))
    )}\n` +
    `Borrador: ${resumenCandidato}\n\n` +
    `Responde SOLO un JSON: {"resumen":"string","servicio_ids":["uuid", ...]}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}` +
    `:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(env.iaTimeoutMs),
  });

  if (!response.ok) {
    const detalle = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status} ${detalle.slice(0, 180)}`);
  }

  const data = await response.json();
  // Un modelo de razonamiento devuelve partes SIN campo `text` (solo
  // la firma del pensamiento). Sin el filtro, esas partes inyectan
  // "undefined" en la cadena y rompen el parseo del JSON, dejando que
  // el blob crudo se cuele como si fuera el resumen.
  const texto = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text)
    .filter((p) => typeof p === 'string' && p.trim())
    .join('\n')
    .trim();
  const parsed = extraerJson(texto);
  // Si el modelo prometió JSON y no lo cumplió, se descarta: devolver
  // el texto crudo solo sirve para filtrar un blob al usuario final.
  const resumen = typeof parsed?.resumen === 'string' ? parsed.resumen.trim() : '';
  const servicioIds = Array.isArray(parsed?.servicio_ids)
    ? parsed.servicio_ids.map(String).filter((id) => idsPermitidos.includes(id))
    : [];

  if (!resumen) return null;
  return { resumen, servicioIds, fuente: 'gemini' };
}

// Un modelo puede devolver JSON truncado, una llave suelta o un bloque
// de código cuando el prompt falla, el modelo configurado no existe o
// se agota el presupuesto de tokens. Sin esta validación ese ruido
// PISA el resumen determinista y llega tal cual al usuario final, que
// es justo lo que la arquitectura promete que no puede pasar: la IA
// solo redacta encima de datos correctos, y si no sabe redactar, se
// cae a la plantilla.
function esResumenValido(texto) {
  const limpio = String(texto ?? '').trim();
  if (limpio.length < 60) return false;
  if (/^[{}[\]("'`]/.test(limpio)) return false;
  if (/^(json|```)/i.test(limpio)) return false;
  // Debe leerse como prosa: al menos unas cuantas palabras reales.
  return limpio.split(/\s+/).filter((palabra) => /[a-záéíóúñ]{3,}/i.test(palabra)).length >= 12;
}

export async function filtrarMejorRespuesta(contexto) {
  const candidatos = [];

  const n8n = await filtrarConN8n(contexto);
  if (n8n?.resumen) candidatos.push({ ...n8n, fuente: 'n8n' });

  if (!candidatos.length) {
    try {
      const gemini = await filtrarConGemini(contexto);
      if (gemini?.resumen) candidatos.push(gemini);
    } catch (err) {
      console.warn('[iaFilter] Gemini no disponible:', err.message);
    }
  }

  for (const candidato of candidatos) {
    if (esResumenValido(candidato.resumen)) return candidato;
    console.warn(`[iaFilter] Resumen descartado por formato inválido (fuente=${candidato.fuente}): ${JSON.stringify(String(candidato.resumen).slice(0, 80))}`);
    // El reordenamiento de servicios sí puede aprovecharse aunque la
    // redacción sea inservible: son señales independientes.
    if (candidato.servicioIds?.length && contexto.resumenCandidato) {
      return { resumen: contexto.resumenCandidato, servicioIds: candidato.servicioIds, fuente: 'plantilla' };
    }
  }

  if (contexto.resumenCandidato) {
    return { resumen: contexto.resumenCandidato, servicioIds: [], fuente: 'plantilla' };
  }
  return null;
}

export const _internal = { esResumenValido };
