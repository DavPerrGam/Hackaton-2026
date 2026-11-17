// =====================================================================
// Motor de suficiencia · cuándo dejar de preguntar
// ---------------------------------------------------------------------
// La regla del consultor: si ya tienes suficiente información, detente
// y entrega el diagnóstico. Este módulo decide, sobre las respuestas
// del núcleo, si queda algo que REALMENTE valga una pregunta más.
//
// Solo se profundiza cuando se detecta una de estas cuatro cosas:
//   1. Inconsistencia   -> lo declarado no cuadra entre sí.
//   2. Información faltante importante -> un dato que cambia el
//      diagnóstico y que no se pudo deducir.
//   3. Riesgo           -> una señal que compromete la ejecución.
//   4. Oportunidad      -> una vía de valor que la organización no vio.
//
// Tope duro: TRES preguntas adicionales. Un consultor con una reunión
// de cinco minutos no gasta la sexta pregunta en curiosidad.
//
// CONGELADO, NO RECALCULADO: el plan se calcula UNA sola vez, cuando el
// núcleo se cierra, y queda guardado en `respuestas._profundizacion`.
// Si se recalculara en cada petición, responder una profundización
// podría desactivar su propio detector (por ejemplo, declarar las
// entidades objetivo apaga el detector que preguntó por ellas), la
// pregunta desaparecería de la lista visible y el índice de paso
// retrocedería a mitad de la conversación.
// =====================================================================

import { detectarEnfoques } from './classification.js';

export const MAX_PROFUNDIZACIONES = 3;

// Última pregunta del núcleo. Hasta que no esté respondida no tiene
// sentido evaluar suficiencia: el consultor todavía está escuchando.
export const CAMPO_CIERRE_NUCLEO = 'objetivo_6_meses';

function texto(valor) {
  return String(valor ?? '').trim();
}

function vacio(valor) {
  const t = texto(valor).toLowerCase();
  return !t || ['no', 'ninguna', 'ninguno', 'n/a', 'na', 'nada', '-'].includes(t);
}

// Cuánto perfil cualitativo entregó la organización por su cuenta. Es
// el umbral que separa "ya entendí a qué se dedican" de "me contestaron
// en tres palabras y todavía no sé qué venden".
const CAMPOS_PERFIL = [
  'tipo_bien_servicio', 'problema_que_resuelve', 'diferenciador',
  'reto_actual', 'objetivo_6_meses',
];
const PERFIL_SUFICIENTE = 120;

function longitudPerfil(respuestas) {
  return CAMPOS_PERFIL.map((c) => texto(respuestas[c])).join(' ').trim().length;
}

// Una pregunta de profundización por enfoque: la de mayor rendimiento
// diagnóstico de cada bloque. No se abren cinco preguntas por enfoque,
// se abre LA que más cambia el perfilamiento.
const PROFUNDIZACION_POR_ENFOQUE = {
  tecnologia: 'tec_dependencia_objetivo',
  formacion: 'for_resultados',
  consultoria: 'con_resultados',
  fundacion: 'fun_territorios',
  universidad: 'uni_lineas_investigacion',
};

// Catálogo de detectores, en ORDEN DE PRIORIDAD. El primero que dispara
// se lleva el primer cupo. Cada uno declara el tipo de señal que
// representa, porque el reporte debe poder explicar por qué el agente
// hizo esa pregunta extra y no otra.
const DETECTORES = [
  {
    id: 'inconsistencia_contratacion',
    tipo: 'inconsistencia',
    pregunta: 'figura_contratacion',
    // Dice haber contratado con el Estado pero no tiene ni RUP ni
    // expediente documental: o contrató por una figura especial
    // (convenio, unión temporal, régimen especial) o hay un error en lo
    // declarado. Ambas respuestas cambian el diagnóstico jurídico.
    aplica: (r) => r.experiencia_previa_contratos === true
      && r.tiene_rup !== true
      && r.gestion_documental !== true,
    razon: 'Declara contratos públicos ejecutados sin RUP ni expediente documental organizado.',
  },
  {
    id: 'oferta_sin_problema',
    tipo: 'informacion_faltante',
    pregunta: 'problema_detallado',
    // Sin el problema bien delimitado no hay cadena servicio ->
    // necesidad pública -> entidad, que es el corazón del perfilamiento.
    aplica: (r) => texto(r.problema_que_resuelve).length < 25,
    razon: 'El problema que resuelve quedó enunciado de forma demasiado general.',
  },
  {
    id: 'enfoque_dominante',
    tipo: 'oportunidad',
    pregunta: (r) => PROFUNDIZACION_POR_ENFOQUE[detectarEnfoques(r)[0]] || null,
    // Solo cuando el perfil que entregaron se quedó corto. Si ya
    // describieron con detalle qué hacen, qué resuelven y qué esperan,
    // el consultor tiene lo que necesita y no gasta un turno más en
    // confirmar lo que ya entendió.
    aplica: (r) => longitudPerfil(r) < PERFIL_SUFICIENTE,
    razon: 'El perfil cualitativo quedó corto y el enfoque dominante exige evidencia específica para ubicar al comprador público.',
  },
  {
    id: 'riesgo_liquidez',
    tipo: 'riesgo',
    pregunta: 'financiacion_ejecucion',
    // El Estado paga contra entrega: sin capital de trabajo ni colchón
    // de caja, un contrato ganado es un problema, no un logro.
    aplica: (r) => r.capital_trabajo !== true || r.flujo_caja !== true,
    razon: 'No hay capital de trabajo o colchón de caja para sostener la ejecución antes del primer pago.',
  },
  {
    id: 'sin_entidades_objetivo',
    tipo: 'oportunidad',
    pregunta: 'entidades_objetivo',
    aplica: (r) => vacio(r.entidades_objetivo),
    razon: 'No hay entidades públicas objetivo declaradas ni deducibles de la conversación.',
  },
];

/**
 * Calcula el plan de profundización sobre un núcleo ya respondido.
 * Función pura: no lee ni escribe estado. Quien la llama es
 * agentService, que congela el resultado en la sesión.
 *
 * @param {object} respuestas respuestas planas de la sesión
 * @returns {{suficiente: boolean, preguntas: string[], senales: Array}}
 */
export function planificarProfundizacion(respuestas = {}) {
  const senales = [];
  const preguntas = [];

  for (const detector of DETECTORES) {
    if (preguntas.length >= MAX_PROFUNDIZACIONES) break;
    if (detector.aplica && !detector.aplica(respuestas)) continue;
    const preguntaId = typeof detector.pregunta === 'function'
      ? detector.pregunta(respuestas)
      : detector.pregunta;
    if (!preguntaId || preguntas.includes(preguntaId)) continue;
    preguntas.push(preguntaId);
    senales.push({ id: detector.id, tipo: detector.tipo, razon: detector.razon, pregunta: preguntaId });
  }

  return { suficiente: preguntas.length === 0, preguntas, senales };
}

/** El núcleo está cerrado cuando su última pregunta ya fue respondida. */
export function nucleoCompleto(respuestas = {}) {
  return respuestas[CAMPO_CIERRE_NUCLEO] !== undefined;
}

/**
 * Plan vigente de la sesión. Lee el plan CONGELADO; nunca recalcula.
 * Mientras el núcleo esté en curso devuelve un plan vacío, que es lo
 * correcto: todavía no hay nada sobre qué profundizar.
 */
export function profundizacionVigente(respuestas = {}) {
  return respuestas._profundizacion || { suficiente: false, preguntas: [], senales: [] };
}

/** Atajo para el showIf de las preguntas de profundización. */
export function seProfundizaEn(respuestas, preguntaId) {
  return profundizacionVigente(respuestas).preguntas.includes(preguntaId);
}

export const _internal = { DETECTORES, PROFUNDIZACION_POR_ENFOQUE };
