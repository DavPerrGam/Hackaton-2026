// =====================================================================
// Capa de IA generativa (opcional)
// ---------------------------------------------------------------------
// El diagnostico, el indice IDEAPRO, el nivel de madurez, la
// elegibilidad, las brechas y la ruta recomendada son 100%
// deterministas (ver scoring.js, eligibility.js, classification.js,
// valueProposition.js, entityMap.js, recommendation.js y
// actionPlan.js): eso es intencional, porque son la base de un
// producto comercial y deben ser explicables y reproducibles.
//
// La IA generativa se usa unicamente para la capa de REDACCION:
// convertir los datos ya calculados en un resumen ejecutivo con la voz
// de IDEAPRO Intelligence AI ("resumen_ia").
//
// Si no hay ANTHROPIC_API_KEY configurada, se usa una plantilla local
// (`resumenPlantilla`) y el sistema sigue siendo 100% funcional: la IA
// generativa es un "mejor esfuerzo", nunca una dependencia dura.
// =====================================================================

import { env } from '../config/env.js';
import { IDENTIDAD_NEXUS, promptResumenEjecutivo } from './nexusPrompt.js';

const NOMBRES_EJE = {
  oferta: 'oferta y propuesta de valor',
  experiencia: 'experiencia y capacidad demostrable',
  operativa: 'capacidad técnica y operativa',
  legal: 'capacidad jurídica y documental',
  financiera: 'capacidad financiera y garantías',
  comercial: 'conocimiento del ecosistema público',
};

export function resumenPlantilla({ empresa, diagnostico, rutaTop, mapaEntidades }) {
  const ejeCriticoNombre = NOMBRES_EJE[diagnostico.ejeCritico] || diagnostico.ejeCritico;
  const primerServicio = rutaTop?.[0]?.servicio?.nombre_servicio;
  const nivel = diagnostico.nivelMadurez;
  const entrada = mapaEntidades?.entrada_recomendada?.ejemplo_territorial
    || mapaEntidades?.entrada_recomendada?.nombre;

  const alertaElegibilidad = diagnostico.elegibilidad?.estado === 'riesgo'
    ? ` Antes de avanzar debe resolverse un riesgo de elegibilidad: ${diagnostico.elegibilidad.riesgos.map((r) => r.nombre.toLowerCase()).join(', ')}.`
    : diagnostico.elegibilidad?.estado === 'no_elegible'
      ? ' La organización no cumple hoy la condición mínima de antigüedad para competir en el mercado público.'
      : '';

  return (
    `${empresa.nombre} obtuvo un índice IDEAPRO de ${diagnostico.indiceIdeapro}/1000 y se ubica en el nivel ${nivel?.nivel} (${nivel?.nombre}) `
    + `de preparación frente al mercado público, con un riesgo financiero ${diagnostico.riesgoFinanciero?.nivel}.`
    + alertaElegibilidad
    + ` El frente que más limita su avance es ${ejeCriticoNombre}.`
    + (primerServicio
      ? ` El primer paso recomendado es "${primerServicio}", que ataca directamente esa brecha antes de avanzar hacia procesos de mayor exigencia.`
      : ' IDEAPRO recomienda un acompañamiento estratégico a la medida antes de perseguir procesos de mayor exigencia.')
    + (entrada ? ` La puerta de entrada institucional sugerida es ${entrada}.` : '')
  );
}

export async function generarResumenIA({ empresa, diagnostico, rutaTop, clasificacion, perfilamiento, mapaEntidades, tags, relaciones }) {
  if (!env.anthropicApiKey) {
    return resumenPlantilla({ empresa, diagnostico, rutaTop, mapaEntidades });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.anthropicModel,
        max_tokens: 500,
        system: IDENTIDAD_NEXUS,
        messages: [
          {
            role: 'user',
            content: promptResumenEjecutivo({ empresa, diagnostico, rutaTop, clasificacion, perfilamiento, mapaEntidades, tags, relaciones }),
          },
        ],
      }),
      signal: AbortSignal.timeout(env.iaTimeoutMs),
    });

    if (!response.ok) throw new Error(`Anthropic API respondió ${response.status}`);

    const data = await response.json();
    const texto = data.content?.find((b) => b.type === 'text')?.text;
    return texto?.trim() || resumenPlantilla({ empresa, diagnostico, rutaTop, mapaEntidades });
  } catch (err) {
    console.warn('[llmClient] Fallback a plantilla local:', err.message);
    return resumenPlantilla({ empresa, diagnostico, rutaTop, mapaEntidades });
  }
}
