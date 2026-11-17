import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import {
  getStepByIndex, totalSteps, getVisibleQuestions, esInicioDeBloque, CAMPOS_MEMORIA,
  derivarRespuestas, camposEmpresaDe, camposVisibles, definicionDeLlave, QUESTIONS,
} from '../agent/questions.js';
import { aplicarInferencias, describirInferencias } from '../agent/inference.js';
import { planificarProfundizacion, nucleoCompleto } from '../agent/sufficiency.js';
import { calcularDiagnostico } from '../agent/scoring.js';
import { clasificarOrganizacion } from '../agent/classification.js';
import { generarTags } from '../agent/tags.js';
import { calcularRelacionesEmpresariales, perfilComparable } from '../agent/similarity.js';
import { perfilarOferta } from '../agent/valueProposition.js';
import { construirMapaEntidades } from '../agent/entityMap.js';
import { construirPlanAccion } from '../agent/actionPlan.js';
import { construirReporteFinal } from '../agent/report.js';
import { construirRutaRecomendada } from '../agent/recommendation.js';
import { calcularEncajeOportunidades, identificarOportunidadesReales } from '../agent/opportunityMatch.js';
import { generarResumenIA } from '../agent/llmClient.js';
import { reordenarRutaConFiltro } from '../agent/n8nFilter.js';
import { filtrarMejorRespuesta } from '../agent/iaFilter.js';
import { interpretarMensaje, respuestaTieneEvidenciaNumerica } from '../agent/n8nChat.js';
import * as empresaService from './empresaService.js';
import * as catalogoService from './catalogoService.js';
import * as documentService from './documentService.js';
import * as alertService from './alertService.js';

const CONFIANZA_MINIMA_CHAT = 0.65;
const RESPUESTA_SEGURA_CHAT = 'No puedo afirmar eso con la información disponible en tu diagnóstico. Reformula la pregunta o indica el dato concreto que quieres revisar.';
export const MAX_ANIOS_OPERACION = 100;

export function generarRespuestaDiagnosticoLocal(contexto, mensajeUsuario = '') {
  const diag = contexto?.diagnostico || {};
  const scores = diag.scores || {};
  const nivel = diag.nivelMadurez?.global || diag.nivelMadurezGlobal || 'no disponible';
  const riesgoOriginal = diag.riesgoFinanciero || diag.riesgoElegibilidad || 'no disponible';
  const ruta = Array.isArray(diag.ruta) && diag.ruta.length > 0
    ? diag.ruta.map((item) => item.nombre || item.servicio || item.tipo).filter(Boolean).slice(0, 2)
    : [];
  const ejeCritico = diag.ejeCritico || 'no identificado';
  const indice = diag.indiceIdeapro ?? diag.indice_ideapro ?? null;
  const pregunta = String(mensajeUsuario || '').trim();
  const preguntaLower = pregunta.toLowerCase();

  const fragments = [];

  if (/puntaje|score|indice|valor/i.test(preguntaLower)) {
    fragments.push(indice !== null ? `El puntaje actual es ${indice}/1000.` : 'El puntaje global del diagnóstico está disponible.');
  }
  if (/riesgo|financiero/i.test(preguntaLower)) {
    if (riesgoOriginal && riesgoOriginal !== 'no disponible') {
      fragments.push(`El riesgo financiero del perfil se describe como ${riesgoOriginal}.`);
    } else {
      fragments.push('No aparece un riesgo financiero detallado en este diagnóstico.');
    }
  }
  if (/solvencia|operativo|músculo|capacidad|operativa/i.test(preguntaLower)) {
    const financiera = scores.financiera ?? 'sin dato';
    const operativa = scores.operativa ?? 'sin dato';
    fragments.push(`La capacidad operativa y la solvencia se observan con indicadores de operativa ${operativa} y financiera ${financiera}.`);
  }
  if (/fortalec|priorit|oferta|ruta|valor/i.test(preguntaLower)) {
    const eje = ejeCritico && ejeCritico !== 'no identificado' ? ejeCritico : 'el eje más crítico del diagnóstico';
    const rutaTexto = ruta.length ? `La ruta recomendada prioriza ${ruta.join(' y ')}.` : 'La ruta recomendada aún está definida por los servicios que mejor encajan con el diagnóstico.';
    fragments.push(`El frente prioritario identificado es ${eje}. ${rutaTexto}`);
  }
  if (/madurez|nivel/i.test(preguntaLower)) {
    fragments.push(nivel && nivel !== 'no disponible' ? `El nivel de madurez global reportado es ${nivel}.` : 'El nivel de madurez global está disponible en el diagnóstico.');
  }

  if (!fragments.length) {
    if (indice !== null) fragments.push(`Con un puntaje de ${indice}/1000`);
    if (nivel && nivel !== 'no disponible') fragments.push(`y nivel de madurez ${nivel}`);
    if (riesgoOriginal && riesgoOriginal !== 'no disponible') fragments.push(`con riesgo financiero ${riesgoOriginal}`);
    fragments.push('el diagnóstico apunta a fortalecer los ejes más críticos y priorizar la ruta recomendada.');
  }

  const observacion = [];
  if (diag.resumen && typeof diag.resumen === 'string') observacion.push(diag.resumen);
  if (scores.financiera !== undefined || scores.operativa !== undefined || scores.oferta !== undefined) {
    const scoreFinanciera = scores.financiera ?? 'sin dato';
    const scoreOperativa = scores.operativa ?? 'sin dato';
    const scoreOferta = scores.oferta ?? 'sin dato';
    observacion.push(`Los indicadores relevantes son financiera ${scoreFinanciera}, operativa ${scoreOperativa} y oferta ${scoreOferta}.`);
  }
  if (ejeCritico && ejeCritico !== 'no identificado') observacion.push(`El eje crítico detectado es ${ejeCritico}.`);
  if (ruta.length) observacion.push(`La ruta recomendada prioriza ${ruta.join(' y ')}.`);

  const cuerpo = observacion.length ? observacion.join(' ') : 'La información disponible sugiere que tu diagnóstico está orientado a fortalecer los ejes más críticos y priorizar la ruta recomendada.';
  return `${fragments.join(' ')} ${cuerpo} Si quieres, te puedo explicar más detalle sobre ese eje, la ruta o los indicadores que más te están condicionando.`;
}

function respuestaIAConfiable(respuesta) {
  return Boolean(
    respuesta
    && typeof respuesta.reply === 'string'
    && respuesta.reply.trim().length >= 3
    && Number.isFinite(Number(respuesta.confidence))
    && typeof respuesta.confidence === 'number'
    && respuesta.confidence >= CONFIANZA_MINIMA_CHAT
    && respuesta.confidence <= 1
  );
}

export function construirEntrevista(respuestas = {}, mensajesRaw = []) {
  const mensajesPreguntas = new Map(
    (Array.isArray(mensajesRaw) ? mensajesRaw : [])
      .filter((mensaje) => mensaje?.role === 'agent' && mensaje.step)
      .map((mensaje) => [mensaje.step, mensaje.content])
  );
  const preguntasRealizadas = QUESTIONS
    .filter((pregunta) => mensajesPreguntas.has(pregunta.id))
    .map((pregunta) => ({
      id: pregunta.id,
      etapa: pregunta.etapa,
      bloque: pregunta.bloque,
      tipo: pregunta.type,
      pregunta: mensajesPreguntas.get(pregunta.id) || pregunta.prompt,
      respuesta: pregunta.type === 'form'
        ? Object.fromEntries(pregunta.campos.map((campo) => [campo.id, respuestas[campo.id]]).filter(([, valor]) => valor !== undefined))
        : pregunta.type === 'multi'
          ? (pregunta.options || []).filter((opcion) => respuestas[opcion.value] === true).map((opcion) => opcion.label)
          : respuestas[pregunta.id],
    }));

  return {
    preguntas_realizadas: preguntasRealizadas,
    respuestas_completas: respuestas,
  };
}

// Las preguntas compuestas viajan con sus sub-definiciones ya filtradas
// por memoria inteligente: el frontend nunca debe pintar un campo que la
// organización ya respondió en un diagnóstico anterior. `showIf` no se
// serializa (es una función del servidor); la condición interna de un
// campo viaja como `mostrarSi`, que sí es declarativa.
function serializarCampos(pregunta, respuestas) {
  if (pregunta.type !== 'form' && pregunta.type !== 'multi') return null;
  return camposVisibles(pregunta, respuestas).map((campo) => ({
    id: campo.id ?? campo.value,
    type: campo.type || 'boolean',
    label: campo.label,
    required: Boolean(campo.required),
    options: campo.options || null,
    optionsSource: campo.optionsSource || null,
    placeholder: campo.placeholder || null,
    mostrarSi: campo.mostrarSi || null,
  }));
}

function serializarPregunta(pregunta, indice, total, respuestas = {}) {
  if (!pregunta) return null;
  return {
    id: pregunta.id,
    dimension: pregunta.dimension,
    type: pregunta.type,
    prompt: pregunta.prompt,
    options: pregunta.type === 'multi' ? null : (pregunta.options || null),
    optionsSource: pregunta.optionsSource || null,
    // `campos` sirve a los dos tipos compuestos: en `form` son los
    // campos del formulario, en `multi` las casillas del checklist.
    campos: serializarCampos(pregunta, respuestas),
    required: pregunta.required,
    // Etapa y bloque permiten que el frontend anuncie en qué fase del
    // protocolo Nexus va la conversación en vez de mostrar un contador
    // de formulario plano.
    etapa: pregunta.etapa || null,
    bloque: pregunta.bloque || null,
    inicioDeBloque: esInicioDeBloque(pregunta, respuestas),
    paso: indice + 1,
    totalPasos: total,
  };
}

export async function iniciarSesion({ canal = 'web', publicUserId }) {
  const empresa = await empresaService.crearEmpresaBorrador();
  const { data: sesion, error } = await supabaseAdmin
    .from('sesiones')
    .insert({
      empresa_id: empresa.id,
      usuario_publico_id: publicUserId,
      canal,
      paso_actual: 0,
      respuestas: {},
      estado: 'en_curso',
      mensajes_raw: [],
    })
    .select()
    .single();

  if (error) throw new ApiError(500, 'No se pudo iniciar la sesión del agente', error.message);

  const primeraPregunta = getStepByIndex(0, {});
  return {
    sesionId: sesion.id,
    empresaId: empresa.id,
    pregunta: serializarPregunta(primeraPregunta, 0, totalSteps({})),
  };
}

async function obtenerSesion(sesionId, publicUserId) {
  const { data, error } = await supabaseAdmin.from('sesiones').select('*').eq('id', sesionId).maybeSingle();
  if (error) throw new ApiError(500, 'Error consultando la sesión', error.message);
  if (!data) throw new ApiError(404, 'Sesión no encontrada');
  if (publicUserId && data.usuario_publico_id !== publicUserId) {
    throw new ApiError(404, 'Sesión no encontrada');
  }
  return data;
}

export async function obtenerEstadoSesion(sesionId, publicUserId) {
  const sesion = await obtenerSesion(sesionId, publicUserId);
  const total = totalSteps(sesion.respuestas);
  const pregunta = sesion.completada ? null : getStepByIndex(sesion.paso_actual, sesion.respuestas);

  return {
    sesionId: sesion.id,
    empresaId: sesion.empresa_id,
    completada: sesion.completada,
    paso_actual: sesion.paso_actual,
    totalPasos: total,
    respuestas: sesion.respuestas,
    pregunta: serializarPregunta(pregunta, sesion.paso_actual, total, sesion.respuestas),
  };
}

function normalizarTexto(valor) {
  return String(valor ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function esNombreSinEmpresa(valor) {
  const nombre = normalizarTexto(valor);
  return /^(no|ninguna|ninguno|n\/a)$/.test(nombre)
    || /\b(no tengo|sin|no hay|no existe)\s+(una\s+)?empresa\b/.test(nombre);
}

export function esIdentidadInvalida(pregunta, valor, { permitirNombreUnico = false } = {}) {
  if (!['nombre', 'nombre_contacto', 'cargo_contacto'].includes(pregunta.id)) return false;

  const texto = normalizarTexto(valor);
  if (!texto || !/[a-z]/.test(texto)) return true;

  if (['nombre_contacto', 'cargo_contacto'].includes(pregunta.id)) {
    const frasesGenericas = ['si soy', 'soy yo', 'yo soy', 'yo', 'mi nombre es', 'nombre', 'sin cargo', 'ninguno'];
    if (frasesGenericas.includes(texto) || /^(si|soy|yo)\b/.test(texto) || /^(mi|el|la)\s+(cargo|rol|puesto)\b/.test(texto)) return true;
  }

  if (pregunta.id === 'nombre') {
    const describeActividad = /\b(vende|vendemos|ofrece|ofrecemos|fabrica|fabricamos|presta|prestamos|comercializa|comercializamos|dedicad[ao]|nos dedicamos)\b/.test(texto);
    if (describeActividad) return true;

    const original = String(valor ?? '').trim();
    const sinEspacios = texto.replace(/\s+/g, '');
    if (/^([a-z])\1+$/.test(sinEspacios) || /^[aeiou]{2,}$/.test(sinEspacios) || /^[bcdfghjklmnpqrstvwxyz]{2,}$/.test(sinEspacios)) {
      return true;
    }

    const letras = texto.replace(/[^a-z]/g, '');
    const vocales = (letras.match(/[aeiou]/g) || []).length;
    const tieneRazonSocial = /\b(sas|s\.a\.s?|ltda|limitada|e\.?u\.?|s\.?c\.?a\.?)\b/.test(texto);
    const tieneVariasPalabras = texto.split(/\s+/).filter(Boolean).length > 1;
    const marcaCorta = /^[A-Z0-9]{2,4}$/.test(original);
    const grafiaAtipica = /w/.test(texto)
      && !/[A-Z]/.test(original)
      && !tieneRazonSocial
      && !tieneVariasPalabras;
    const repeticionCorta = /^(.{2,3})\1+$/.test(letras);
    const patronRepetido = /^([a-z]{2,4})\1+[a-z]?$/.test(letras);
    const teclado = /^(qwerty|asdf|zxcv|qazwsx|qweasd|poiuy|lkjhg|mnbvc)/.test(texto);
    const consonantesAnomalas = /[bcdfghjklmnpqrstvwxyz]{3,}/.test(letras)
      || /[bcdfghjklmnpqrstvwxyz][qwxy][bcdfghjklmnpqrstvwxyz]/.test(letras);
    const pareceAleatorio = letras.length >= 4
      && vocales / letras.length <= 0.25
      && !tieneRazonSocial
      && !tieneVariasPalabras
      && !marcaCorta;
    if (pareceAleatorio || grafiaAtipica || repeticionCorta || patronRepetido || teclado || consonantesAnomalas
      || /^(asdf|qwerty|test|prueba|sdd|daswa)/.test(texto)) return true;
  }

  const frasesGenericas = pregunta.id === 'nombre'
    ? [
      'empresa', 'mi empresa', 'la empresa', 'el negocio', 'mi negocio',
      'en la empresa', 'en mi empresa', 'no se', 'no recuerdo', 'una cosa',
      'algo', 'ninguna', 'n a', 'yo', 'soy yo', 'hola', 'holi', 'hey', 'buenas',
    ]
    : [
      'yo', 'soy yo', 'en la empresa', 'mi jefe', 'el jefe', 'la encargada',
      'el encargado', 'la persona encargada', 'el usuario', 'cliente',
      'no se', 'no recuerdo', 'alguien', 'hola', 'holi', 'hey', 'buenas',
    ];

  return frasesGenericas.includes(texto)
    || /^(quien|quien soy|con quien|no tengo nombre|sin nombre)/.test(texto)
    || /^(la|el)\s+(empresa|persona|compania|compañia|negocio)/.test(texto);
}

function aclaracionParaIdentidad(pregunta) {
  if (pregunta.id === 'nombre') {
    return 'Solo se aceptan nombres específicos de empresas, comerciales o legales (por ejemplo, "Rappi" o "Café Andino S.A.S."). Escribe únicamente el nombre de tu empresa, no palabras sueltas ni texto sin sentido.';
  }
  return 'Necesito el nombre real de la persona de contacto, por ejemplo: Ana García.';
}

const RESPUESTAS_NO_PERTINENTES = new Set([
  'pene', 'verga', 'culo', 'coño', 'porno', 'sexo', 'puta', 'puto', 'mierda',
  'hola', 'holi', 'hey', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
  'quiero pizza', 'pizza', 'futbol', 'fútbol', 'videojuego', 'videojuegos',
  'un chiste', 'cuentame un chiste', 'cuéntame un chiste', 'una receta', 'receta',
  'quiero aprender a cocinar', 'aprender a cocinar', 'cocinar', 'comida', 'cocina',
  'jugar futbol', 'me gusta jugar futbol', 'series', 'pelicula', 'películas',
  'no se', 'nose', 'no sé', 'no tengo idea', 'no tengo ni idea', 'no lo se', 'no lo sé',
  'depende', 'depende de muchas cosas', 'siempre', 'a veces', 'quizas', 'quizá', 'tal vez',
  'ok', 'vale', 'bien', 'gracias', 'buenas', 'adios', 'hasta luego', 'como estas', 'cómo estás',
]);

export function esPreguntaSinContexto(mensaje) {
  const texto = normalizarTexto(mensaje ?? '');
  if (!texto || texto.length < 3) return true;
  if (RESPUESTAS_NO_PERTINENTES.has(texto)) return true;
  if (/^(qwerty|asdf|zxcv|lkjhg|mnbvc|uiop|poiu|sdfg|dfgh|fghj|rtyu|tyui|yuiop)$/i.test(texto)) return true;
  if (/^(si|no|vale|ok|gracias|hola|hey|buenas)$/i.test(texto)) return true;
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length <= 2 && !/[a-z]{5,}/.test(texto)) return true;
  return false;
}

const RESPUESTAS_VAGAS = new Set([
  'no se', 'nose', 'no sé', 'no tengo idea', 'no tengo ni idea', 'no lo se', 'no lo sé',
  'depende', 'depende de muchas cosas', 'algo', 'algun', 'alguna', 'varias cosas',
  'no estoy seguro', 'no estoy segura', 'mas o menos', 'm.a.s. o menos', 'no recuerdo',
  'por ahi', 'por ahí', 'como sea', 'cualquiera', 'todo', 'nada', 'no se sabe',
]);

const PALABRAS_CLAVE_POR_CONTEXTO = {
  tipo_organizacion: ['empresa', 'fundacion', 'organizacion', 'asociacion', 'cooperativa', 'universidad', 'ong', 'corporacion', 'institucion', 'sociedad', 'sas', 'ltda', 'consultora', 'tecnologia'],
  tipo_bien_servicio: ['servicio', 'producto', 'vendemos', 'ofrecemos', 'software', 'solucion', 'consultoria', 'asesoria', 'formacion', 'capacitacion', 'sistema', 'plataforma', 'digital', 'gestion', 'logistica', 'infraestructura', 'marketing', 'analisis', 'analitica'],
  problema_que_resuelve: ['problema', 'cliente', 'solucion', 'reduce', 'mejora', 'eficiencia', 'calidad', 'tiempo', 'costo', 'procesos', 'digitaliza', 'gestiona', 'controla'],
};

const PATRONES_ACCION_NEGOCIO = [
  'vendemos', 'ofrecemos', 'prestamos', 'entregamos', 'brindamos', 'diseñamos',
  'desarrollamos', 'gestionamos', 'conectamos', 'facilitamos', 'operamos',
  'creamos', 'impulsamos', 'digitalizamos', 'monetizamos', 'acompañamos',
  'nos dedicamos', 'nos especializamos', 'trabajamos', 'somos', 'estamos enfocados',
];

const TERMINOS_NEGOCIO = [
  'servicio', 'producto', 'solucion', 'app', 'superapp', 'plataforma', 'sistema',
  'digital', 'entrega', 'domicilio', 'clientes', 'usuarios', 'empresa', 'negocio',
  'operacion', 'logistica', 'gestion', 'tecnologia', 'software', 'proceso',
  'restaurantes', 'supermercados', 'farmacias', 'entregas', 'conectamos', 'integramos',
];

export function esRespuestaNoPertinente(pregunta, valor) {
  if (pregunta.type === 'form') {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      for (const campo of pregunta.campos || []) {
        const dato = valor[campo.id];
        if (dato === undefined || dato === null || dato === '') continue;
        if (esRespuestaNoPertinente({ ...campo, prompt: campo.label, type: campo.type || 'text' }, dato)) {
          return true;
        }
      }
      return false;
    }
    return esRespuestaNoPertinente({
      ...pregunta,
      type: 'textarea',
      id: pregunta.id || 'respuesta_form',
    }, String(valor ?? ''));
  }

  const respuesta = normalizarTexto(valor);
  if (pregunta.id === 'anios_operacion') {
    // "año" no responde cuánto tiempo llevan operando: debe reintentarse.
    return convertirAntiguedadEnAnios(respuesta) === undefined;
  }

  if (!['text', 'textarea', 'select'].includes(pregunta.type)) return false;
  if (!respuesta || RESPUESTAS_NO_PERTINENTES.has(respuesta)) return true;

  if (pregunta.id === 'correo_contacto') {
    return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(respuesta);
  }

  if (pregunta.id === 'tipo_bien_servicio') {
    const aceptaActividad = /(?:nos\s+dedicamos|nos\s+especializamos|nos\s+ocupamos|nos\s+enfocamos|trabajamos|ofrecemos|vendemos|prestamos|entregamos|brindamos|desarrollamos|digitalizamos|somos).*\b(?:servicio|producto|solucion|app|superapp|plataforma|sistema|software|digital|logistica|entrega|domicilio|restaurantes|supermercados|farmacias|clientes|usuarios|empresa|negocio)\b/i.test(respuesta)
      || /(?:nos\s+dedicamos|nos\s+especializamos|nos\s+ocupamos|nos\s+enfocamos|trabajamos|ofrecemos|vendemos|prestamos|entregamos|brindamos|desarrollamos|digitalizamos)\b/i.test(respuesta);

    if (aceptaActividad) return false;
  }

  if (pregunta.id === 'sitio_web') {
    return !['no', 'no tengo', 'sin sitio web'].includes(respuesta)
      && !/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/.test(respuesta);
  }

  if (pregunta.type === 'select' && Array.isArray(pregunta.options)) {
    return !pregunta.options.some((opcion) => (
      respuesta === normalizarTexto(opcion.value)
      || respuesta === normalizarTexto(opcion.label)
    ));
  }

  if (RESPUESTAS_VAGAS.has(respuesta)) return true;
  if (/^(no|nunca|nada|nadie|depende|quizas|quizá|tal vez|mas o menos|más o menos|no se|nose|no sé|no tengo idea|no tengo ni idea)(\s|$)/.test(respuesta)) {
    return true;
  }

  const palabrasClave = PALABRAS_CLAVE_POR_CONTEXTO[pregunta.id] || [];
  if (palabrasClave.length > 0) {
    const coincideContexto = palabrasClave.some((palabra) => respuesta.includes(palabra));
    const tieneAccionNegocio = PATRONES_ACCION_NEGOCIO.some((patron) => respuesta.includes(patron));
    const tieneTerminoNegocio = TERMINOS_NEGOCIO.some((termino) => respuesta.includes(termino));

    if (!coincideContexto && !(tieneAccionNegocio && tieneTerminoNegocio)) {
      return true;
    }
  }

  const letras = respuesta.replace(/[^a-z]/g, '');
  const patronRepetido = /^([a-z]{2,4})\1+[a-z]?$/.test(letras);
  const teclado = /^(qwerty|asdf|zxcv|qazwsx|qweasd|poiuy|lkjhg|mnbvc)/.test(respuesta);
  const consonantesAnomalas = /[bcdfghjklmnpqrstvwxyz]{4,}/.test(letras);
  return patronRepetido || teclado || consonantesAnomalas;
}

function aclaracionParaPregunta(pregunta) {
  return `Tu respuesta debe estar relacionada con esta pregunta: "${pregunta.prompt}". Cuéntame algo concreto sobre tu empresa.`;
}

const NIVEL_LEGACY = {
  exploracion: 'inicial',
  preparacion: 'en_desarrollo',
  lista_para_explorar: 'intermedio',
  preparada: 'avanzado',
  consolidada: 'avanzado',
};

// Columnas que introdujo cada evolución del esquema. Si la base aún no
// tiene la migración aplicada, el insert falla nombrando la columna
// ausente y reintentamos sin ella: el diagnóstico se guarda igual y el
// agente sigue operativo (degradación controlada, no caída).
const COLUMNAS_NEXUS = [
  'nivel_madurez_numero', 'estado_elegibilidad', 'elegibilidad',
  'riesgo_financiero', 'riesgo_financiero_detalle', 'brechas_por_familia',
  'clasificacion_sectorial', 'perfilamiento_oferta', 'entidades_objetivo',
  'plan_accion', 'reporte_final',
  // Etapas 4 y 11 (database/migration_nexus_relaciones.sql)
  'tags', 'organizaciones_similares',
];

const COLUMNAS_2026 = ['brechas', 'dimensiones_ideapro', 'fase_ruta'];

function esquemaDiagnosticoNuevoNoDisponible(error) {
  const mensaje = String(error?.message || '').toLowerCase();
  return [...COLUMNAS_NEXUS, ...COLUMNAS_2026].some((columna) => mensaje.includes(columna))
    || mensaje.includes('nivel_madurez_enum');
}

function esquemaNexusNoDisponible(error) {
  const mensaje = String(error?.message || '').toLowerCase();
  return COLUMNAS_NEXUS.some((columna) => mensaje.includes(columna));
}

function extraerNombreEmpresaExplicito(valor) {
  const texto = String(valor ?? '').trim();
  const patrones = [
    /^(.+?)\s+es\s+(?:el\s+nombre\s+de\s+)?mi\s+empresa$/i,
    /^mi\s+empresa\s+es\s+(.+)$/i,
  ];

  for (const patron of patrones) {
    const coincidencia = texto.match(patron);
    if (coincidencia?.[1]?.trim()) return coincidencia[1].trim();
  }
  return undefined;
}

function esMenosDeUnAnio(valor) {
  const texto = normalizarTexto(valor);
  if (/(^|\s)-\s*\d/.test(texto)) return true;
  const antiguedad = convertirAntiguedadEnAnios(texto);
  return (antiguedad !== undefined && antiguedad < 1)
    || /\b(0|cero)\s+an?os?\b/.test(texto)
    || /\bmenos\s+de\s+un\s+an?o\b/.test(texto)
    || /\b(aun no|todavia no)\s+(lleva|cumple)\b/.test(texto)
    || /\b\d+\s*(dia|dias|mes|meses)\b/.test(texto);
}

export function esMayorAlMaximoDeOperacion(valor) {
  const antiguedad = convertirAntiguedadEnAnios(valor);
  return antiguedad !== undefined && antiguedad > MAX_ANIOS_OPERACION;
}

function tieneCaracteresNoPermitidosEnAntiguedad(valor) {
  return /[^\p{L}\d\s,.]/u.test(String(valor ?? ''));
}

function mensajeCaracteresNoPermitidos() {
  return 'No se aceptan caracteres especiales como #, $, %, &, /, - o *. Indica los años usando un número, por ejemplo: 2 años.';
}

function convertirAntiguedadEnAnios(valor) {
  const texto = normalizarTexto(valor);
  if (/(^|\s)-\s*\d/.test(texto)) return undefined;
  if (/^un\s+an?o$/.test(texto)) return 1;
  const numero = Number(texto);
  if (Number.isFinite(numero)) return numero;

  const coincidencia = texto.match(/(\d+(?:[.,]\d+)?)\s*(mes(?:es)?|an?os?)/);
  if (!coincidencia) return undefined;
  const cantidad = Number(coincidencia[1].replace(',', '.'));
  return coincidencia[2].startsWith('mes') ? cantidad / 12 : cantidad;
}

function prepararValor(pregunta, valor) {
  // Las preguntas compuestas se preparan campo por campo: cada
  // sub-definición se trata como una pregunta simple, de modo que las
  // conversiones existentes (antigüedad en meses, números escritos con
  // texto) siguen aplicando dentro de un formulario.
  if (pregunta.type === 'form') {
    const entrada = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
    const preparado = {};
    for (const campo of pregunta.campos) {
      if (entrada[campo.id] === undefined) continue;
      preparado[campo.id] = prepararValor(campo, entrada[campo.id]);
    }
    return preparado;
  }
  if (pregunta.type === 'multi') {
    const marcadas = Array.isArray(valor) ? valor : [];
    const validas = new Set(pregunta.options.map((o) => o.value));
    return marcadas.filter((v) => validas.has(v));
  }
  if (pregunta.id === 'anios_operacion') {
    const convertido = convertirAntiguedadEnAnios(valor);
    if (convertido !== undefined) return convertido;
  }
  if (pregunta.type === 'number' && typeof valor === 'string') {
    const coincidencia = valor.trim().replace(',', '.').match(/^\d+(?:\.\d+)?/);
    if (coincidencia) return Number(coincidencia[0]);
  }
  if (pregunta.type === 'boolean' && typeof valor === 'string') {
    const t = valor.trim().toLowerCase();
    if (['true', 'si', 'sí', 's', 'yes'].includes(t)) return true;
    if (['false', 'no', 'n'].includes(t)) return false;
  }
  return valor;
}

async function validarOpcionDinamica(pregunta, valor) {
  if (pregunta.optionsSource !== 'sectores') return;
  const sector = await catalogoService.obtenerSectorPorNombre(valor);
  if (!sector) throw new ApiError(400, `El sector "${valor}" no pertenece al catálogo activo`);
}

function rechazarSesionNoElegible(sesionId) {
  return supabaseAdmin
    .from('sesiones')
    .update({
      estado: 'abandonada',
      estado_elegibilidad: 'no_elegible',
      fecha_finalizacion: new Date().toISOString(),
    })
    .eq('id', sesionId);
}

// Un campo obligatorio de una pregunta compuesta puede llegar vacío
// legítimamente por dos razones: la memoria inteligente ya lo heredó de
// un diagnóstico anterior, o su condición interna (`mostrarSi`) no se
// cumple y por tanto nunca se le mostró a la persona.
function campoExigible(campo, valores, respuestasPrevias) {
  if (!campo.required) return false;
  if (respuestasPrevias?.[campo.id] !== undefined) return false;
  if (campo.mostrarSi && valores[campo.mostrarSi.campo] !== campo.mostrarSi.igual) return false;
  return true;
}

export function validarValor(pregunta, valor, opciones = {}) {
  if (pregunta.type === 'form') {
    const valores = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
    for (const campo of pregunta.campos) {
      const dato = valores[campo.id];
      if (campoExigible(campo, valores, opciones.respuestas) && (dato === undefined || dato === null || dato === '')) {
        throw new ApiError(400, `Falta responder "${campo.label}"`);
      }
      if (dato === undefined || dato === '') continue;
      validarValor({ ...campo, prompt: campo.label, required: false }, dato, opciones);
    }
    return valores;
  }

  if (pregunta.type === 'multi') {
    if (!Array.isArray(valor)) {
      throw new ApiError(400, 'Se esperaba la lista de opciones marcadas');
    }
    const validas = new Set(pregunta.options.map((o) => o.value));
    const invalida = valor.find((v) => !validas.has(v));
    if (invalida) throw new ApiError(400, `La opción "${invalida}" no pertenece a esta pregunta`);
    return valor;
  }

  if (pregunta.required && (valor === undefined || valor === null || valor === '')) {
    throw new ApiError(400, `La respuesta a "${pregunta.prompt}" es obligatoria`);
  }
  if (pregunta.type === 'select' && Array.isArray(pregunta.options) && valor !== '' && valor !== undefined) {
    if (!pregunta.options.some((o) => o.value === valor)) {
      throw new ApiError(400, `La opción "${valor}" no pertenece a esta pregunta`);
    }
  }
  if (pregunta.type === 'number' && valor !== '' && valor !== undefined && isNaN(Number(valor))) {
    throw new ApiError(400, 'Se esperaba un valor numérico');
  }
  if (pregunta.id === 'nombre') {
    const nombre = normalizarTexto(valor);
    if (!nombre) throw new ApiError(400, 'Debes indicar el nombre de la empresa para continuar');
    if (esNombreSinEmpresa(nombre)) {
      throw new ApiError(403, 'Este diagnóstico es exclusivo para empresas constituidas. La conversación ha finalizado.');
    }
  }
  if (pregunta.id === 'anios_operacion' && tieneCaracteresNoPermitidosEnAntiguedad(valor)) {
    throw new ApiError(400, mensajeCaracteresNoPermitidos());
  }
  if (esIdentidadInvalida(pregunta, valor, opciones)) {
    throw new ApiError(400, aclaracionParaIdentidad(pregunta));
  }
  if (esRespuestaNoPertinente(pregunta, valor)) {
    throw new ApiError(400, aclaracionParaPregunta(pregunta));
  }
  if (pregunta.id === 'anios_operacion' && esMayorAlMaximoDeOperacion(valor)) {
    throw new ApiError(400, `La antigüedad no puede superar ${MAX_ANIOS_OPERACION} años`);
  }
  if (pregunta.id === 'anios_operacion' && Number(valor) < 1) {
    throw new ApiError(403, 'IDEAPRO está disponible para empresas con al menos 1 año de operación');
  }
  if (pregunta.type === 'boolean' && typeof valor !== 'boolean') {
    // aceptar 'si'/'no' como conveniencia del cliente
    if (valor === 'si' || valor === 'true') return true;
    if (valor === 'no' || valor === 'false') return false;
    throw new ApiError(400, 'Se esperaba una respuesta sí/no');
  }
  return valor;
}

// El historial se lee: un array de ids marcados o un objeto de campos
// no se guardan como "[object Object]" sino como la frase que la
// persona habría dicho en una conversación real.
function resumirRespuesta(pregunta, valor) {
  if (pregunta.type === 'multi') {
    const etiquetas = pregunta.options
      .filter((o) => valor.includes(o.value))
      .map((o) => o.label);
    return etiquetas.length > 0 ? etiquetas.join(' · ') : 'Ninguna de las anteriores';
  }
  if (pregunta.type === 'form') {
    return pregunta.campos
      .filter((c) => valor[c.id] !== undefined && valor[c.id] !== '')
      .map((c) => `${c.label}: ${valor[c.id]}`)
      .join(' · ');
  }
  return String(valor);
}

export async function responderPaso(sesionId, valorCrudo, opciones = {}) {
  const sesion = await obtenerSesion(sesionId, opciones.publicUserId);
  if (sesion.completada) {
    throw new ApiError(409, 'Esta sesión ya fue completada. Solicita el diagnóstico final.');
  }
  if (sesion.estado === 'abandonada') {
    throw new ApiError(409, 'Esta sesión fue cerrada porque la empresa no cumple los requisitos.');
  }

  const pregunta = getStepByIndex(sesion.paso_actual, sesion.respuestas);
  if (!pregunta) {
    throw new ApiError(409, 'No hay una pregunta pendiente. La sesión está lista para el diagnóstico.');
  }

  let valor;
  try {
    await validarOpcionDinamica(pregunta, valorCrudo);
    valor = validarValor(
      pregunta,
      prepararValor(pregunta, valorCrudo),
      { ...opciones, respuestas: sesion.respuestas }
    );
  } catch (error) {
    if (error.statusCode === 403) {
      await rechazarSesionNoElegible(sesionId);
    }
    throw error;
  }

  // Una pregunta compuesta se guarda dos veces: la llave contenedora
  // (para el historial y el control de obligatoriedad) y cada una de
  // sus llaves planas, que son las que leen los motores deterministas.
  // scoring.js sigue viendo exactamente los mismos campos de siempre.
  const derivadas = derivarRespuestas(pregunta, valor);
  if (pregunta.type === 'number' && derivadas[pregunta.id] !== '') {
    derivadas[pregunta.id] = Number(derivadas[pregunta.id]);
  }
  for (const [llave, dato] of Object.entries(derivadas)) {
    const definicion = definicionDeLlave(pregunta, llave);
    if (definicion?.type === 'number' && dato !== '' && dato !== undefined) {
      derivadas[llave] = Number(dato);
    }
  }

  const nuevasRespuestas = { ...sesion.respuestas, ...derivadas };
  if (pregunta.id === 'tipo_organizacion' || pregunta.id === 'sector_texto') {
    if (nuevasRespuestas._inferidos) {
      delete nuevasRespuestas._inferidos[pregunta.id];
      if (Object.keys(nuevasRespuestas._inferidos).length === 0) {
        delete nuevasRespuestas._inferidos;
      }
    }
  }

  // Etapa 12 · memoria inteligente. Al conocer el nombre se busca si
  // esta misma persona ya diagnosticó esta misma organización: si es
  // así, la ficha de identificación se hereda y esas preguntas
  // desaparecen de la conversación. Las capacidades NO se heredan:
  // volver a medirlas es justamente el sentido de un nuevo diagnóstico.
  let memoria = null;
  let respuestasFinales = nuevasRespuestas;
  if (pregunta.id === 'nombre') {
    memoria = await heredarFichaPrevia(sesion, nuevasRespuestas);
    if (memoria) {
      respuestasFinales = memoria.respuestas;
      const cambios = empresaService.filtrarCamposEmpresa(memoria.heredados);
      if (Object.keys(cambios).length > 0) {
        await empresaService.actualizarEmpresa(sesion.empresa_id, cambios);
      }
    }
  }

  // "Si puedes inferirlo, no lo preguntes." Lo que la conversación ya
  // permite deducir (naturaleza jurídica, sector, entidades objetivo) se
  // escribe aquí, y la pregunta correspondiente simplemente desaparece
  // de la lista visible antes de que el agente llegue a ella.
  const inferencia = aplicarInferencias(respuestasFinales);
  respuestasFinales = inferencia.respuestas;

  // Cierre del núcleo: se decide UNA sola vez si hace falta profundizar
  // y en qué, y el plan queda congelado en la sesión. Si no hay señales,
  // el plan sale vacío y la entrevista termina aquí: esa es la regla de
  // "si ya tienes suficiente información, detente".
  if (nucleoCompleto(respuestasFinales) && !respuestasFinales._profundizacion) {
    respuestasFinales = {
      ...respuestasFinales,
      _profundizacion: planificarProfundizacion(respuestasFinales),
    };
  }

  const mensajesRaw = [
    ...(sesion.mensajes_raw || []),
    { role: 'agent', content: pregunta.prompt, step: pregunta.id, timestamp: new Date().toISOString() },
    { role: 'user', content: resumirRespuesta(pregunta, valor), step: pregunta.id, timestamp: new Date().toISOString() },
  ];

  // Si el campo pertenece a la tabla empresas, lo sincronizamos de una
  // vez (permite que el panel administrativo vea avances parciales
  // aunque la empresa abandone el diagnóstico a mitad de camino). Una
  // pregunta compuesta puede aportar varios campos a la vez, y lo
  // inferido también se persiste: es un dato de la organización aunque
  // no lo haya tecleado nadie.
  const cambiosEmpresa = empresaService.filtrarCamposEmpresa({
    ...camposEmpresaDe(pregunta, derivadas),
    ...inferencia.empresaFields,
  });
  if (Object.keys(cambiosEmpresa).length > 0) {
    await empresaService.actualizarEmpresa(sesion.empresa_id, cambiosEmpresa);
  }

  const nuevoPaso = sesion.paso_actual + 1;
  const total = totalSteps(respuestasFinales);
  const completada = nuevoPaso >= total;

  const { error } = await supabaseAdmin
    .from('sesiones')
    .update({
      respuestas: respuestasFinales,
      paso_actual: nuevoPaso,
      mensajes_raw: mensajesRaw,
      completada,
      estado: completada ? 'completada' : 'en_curso',
      estado_elegibilidad: completada ? 'elegible' : sesion.estado_elegibilidad,
      fecha_finalizacion: completada ? new Date().toISOString() : null,
    })
    .eq('id', sesionId);

  if (error) throw new ApiError(500, 'No se pudo guardar la respuesta', error.message);

  const siguientePregunta = completada ? null : getStepByIndex(nuevoPaso, respuestasFinales);

  return {
    sesionId,
    completada,
    paso_actual: nuevoPaso,
    totalPasos: total,
    pregunta: serializarPregunta(siguientePregunta, nuevoPaso, total, respuestasFinales),
    listoParaDiagnostico: completada,
    // El frontend anuncia la memoria para que la organización entienda
    // por qué el agente dejó de preguntarle lo que ya le había contado.
    memoria: memoria
      ? { organizacion: memoria.organizacion, campos: memoria.etiquetas, mensaje: memoria.mensaje }
      : null,
    // Lo mismo con lo deducido: si el agente se saltó una pregunta
    // porque dedujo la respuesta, tiene que decirlo. Una deducción
    // silenciosa se lee como un error del sistema, y una deducción
    // equivocada que nadie ve es peor que una pregunta de más.
    inferencias: inferencia.hubo ? describirInferencias(inferencia.nuevos) : [],
    // Señales que abrieron la profundización, para que el agente pueda
    // explicar por qué hace una pregunta extra y no otra.
    profundizacion: respuestasFinales._profundizacion?.senales || [],
  };
}

// Etapa 12 · memoria inteligente -------------------------------------
// Solo se hereda de una sesión COMPLETADA del mismo usuario público y
// de una organización con el mismo nombre: sin esas dos condiciones el
// agente estaría rellenando la ficha de otra organización.
const ETIQUETAS_MEMORIA = {
  tipo_organizacion: 'tipo de organización',
  nombre_contacto: 'persona de contacto',
  cargo_contacto: 'cargo',
  correo_contacto: 'correo',
  ubicacion_ciudad: 'ciudad',
  ubicacion_departamento: 'departamento',
  sitio_web: 'sitio web',
  sector_texto: 'sector económico',
};

async function heredarFichaPrevia(sesion, respuestas) {
  if (!sesion.usuario_publico_id || !respuestas.nombre) return null;

  const { data, error } = await supabaseAdmin
    .from('sesiones')
    .select('id, respuestas, created_at')
    .eq('usuario_publico_id', sesion.usuario_publico_id)
    .eq('completada', true)
    .neq('id', sesion.id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.warn('[memoria] no se pudo consultar el historial:', error.message);
    return null;
  }

  const objetivo = normalizarTexto(respuestas.nombre);
  const previa = (data || []).find((s) => normalizarTexto(s.respuestas?.nombre) === objetivo);
  if (!previa) return null;

  const heredados = {};
  const ids = [];
  for (const campo of CAMPOS_MEMORIA) {
    const valor = previa.respuestas?.[campo];
    if (valor === undefined || valor === '' || respuestas[campo] !== undefined) continue;
    heredados[campo] = valor;
    ids.push(campo);
  }
  if (ids.length === 0) return null;

  const etiquetas = ids.map((campo) => ETIQUETAS_MEMORIA[campo] || campo);
  return {
    respuestas: { ...respuestas, ...heredados, _memoria: ids },
    heredados,
    etiquetas,
    organizacion: previa.respuestas?.nombre || respuestas.nombre,
    mensaje: `Ya tengo la ficha de ${previa.respuestas?.nombre || respuestas.nombre} de nuestro diagnóstico anterior, así que no te voy a repetir ${etiquetas.join(', ')}. Vamos directo a lo que sí pudo cambiar: sus capacidades.`,
  };
}

function valorLocal(pregunta, mensaje) {
  if (pregunta.type === 'boolean') {
    const texto = String(mensaje).trim().toLowerCase();
    if (['true', 'si', 'sí', 's', 'yes'].includes(texto)) return true;
    if (['false', 'no', 'n'].includes(texto)) return false;
    return undefined;
  }
  if (pregunta.type === 'number') {
    const valor = prepararValor(pregunta, mensaje);
    return Number.isFinite(Number(valor)) ? Number(valor) : undefined;
  }
  return String(mensaje).trim();
}

export async function conversar(sesionId, mensajeUsuario, publicUserId) {
  const sesion = await obtenerSesion(sesionId, publicUserId);
  if (sesion.completada) throw new ApiError(409, 'Esta sesión ya fue completada.');

  const pregunta = getStepByIndex(sesion.paso_actual, sesion.respuestas);
  if (!pregunta) throw new ApiError(409, 'No hay una pregunta pendiente.');

  // Un checklist o un formulario no se interpretan en lenguaje natural:
  // el cliente los envía estructurados por /respuesta. Interpretarlos
  // aquí obligaría a adivinar qué casillas quiso marcar la persona.
  if (pregunta.type === 'multi' || pregunta.type === 'form') {
    throw new ApiError(409, 'Esta pregunta se responde de forma estructurada, no por chat libre.');
  }

  if (pregunta.id === 'anios_operacion' && tieneCaracteresNoPermitidosEnAntiguedad(mensajeUsuario)) {
    return {
      saved: false,
      reply: mensajeCaracteresNoPermitidos(),
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }

  if ((pregunta.id === 'nombre' && esNombreSinEmpresa(mensajeUsuario))
    || (pregunta.id === 'anios_operacion' && esMenosDeUnAnio(mensajeUsuario))) {
    await rechazarSesionNoElegible(sesionId);
    throw new ApiError(
      403,
      pregunta.id === 'nombre'
        ? 'Este diagnóstico es exclusivo para empresas constituidas. La conversación ha finalizado.'
        : 'IDEAPRO está disponible para empresas con al menos 1 año de operación. La conversación ha finalizado.'
    );
  }

  if (pregunta.id === 'anios_operacion' && esMayorAlMaximoDeOperacion(mensajeUsuario)) {
    return {
      saved: false,
      reply: `La antigüedad no puede superar ${MAX_ANIOS_OPERACION} años. Indica un valor verificable e inténtalo de nuevo.`,
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }

  if (esIdentidadInvalida(pregunta, mensajeUsuario, { permitirNombreUnico: true })) {
    return {
      saved: false,
      reply: aclaracionParaIdentidad(pregunta),
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }

  if (esRespuestaNoPertinente(pregunta, mensajeUsuario)) {
    return {
      saved: false,
      reply: aclaracionParaPregunta(pregunta),
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }

  // El onboarding se mantiene determinista mientras se consolidan las
  // preguntas. n8n queda reservado para el chat posterior al diagnóstico.
  const value = valorLocal(pregunta, mensajeUsuario);
  if (value === undefined) {
    return {
      saved: false,
      reply: `No pude interpretar esa respuesta. ${pregunta.prompt}`,
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }
  const interpretacion = {
    reply: pregunta.id === 'nombre'
      ? 'Perfecto, registraré esa organización para continuar.'
      : 'Respuesta registrada.',
    next_action: 'save_answer',
    value,
    confidence: 1,
  };

  const nombreExplicito = pregunta.id === 'nombre'
    ? extraerNombreEmpresaExplicito(mensajeUsuario)
    : undefined;
  if (nombreExplicito) {
    interpretacion = {
      ...interpretacion,
      next_action: 'save_answer',
      value: nombreExplicito,
      confidence: 1,
    };
  }

  const metadata = {
    pregunta_id: pregunta.id,
    next_action: interpretacion.next_action,
    confidence: interpretacion.confidence,
    origen: env.n8nChatWebhookUrl ? 'n8n' : 'backend_fallback',
  };

  const identidadReconocida = pregunta.id === 'nombre'
    && interpretacion.confidence >= 0.65;

  const confianzaIdentidadInsuficiente = pregunta.id !== 'nombre'
    && (pregunta.id === 'nombre_contacto' && interpretacion.confidence < 0.65);

  if (interpretacion.next_action === 'save_answer'
    && (esIdentidadInvalida(pregunta, interpretacion.value, { permitirNombreUnico: identidadReconocida })
      || esRespuestaNoPertinente(pregunta, interpretacion.value)
      || confianzaIdentidadInsuficiente)) {
    await supabaseAdmin.from('interacciones_agente').insert({
      empresa_id: sesion.empresa_id,
      sesion_id: sesion.id,
      fase: 'ONBOARDING',
      mensaje: String(mensajeUsuario ?? ''),
      respuesta_ia: esRespuestaNoPertinente(pregunta, interpretacion.value)
        ? aclaracionParaPregunta(pregunta)
        : aclaracionParaIdentidad(pregunta),
      metadata: { ...metadata, next_action: 'ask_clarification' },
    });
    return {
      saved: false,
      reply: esRespuestaNoPertinente(pregunta, interpretacion.value)
        ? aclaracionParaPregunta(pregunta)
        : aclaracionParaIdentidad(pregunta),
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }

  if (interpretacion.next_action !== 'save_answer') {
    await supabaseAdmin.from('interacciones_agente').insert({
      empresa_id: sesion.empresa_id,
      sesion_id: sesion.id,
      fase: 'ONBOARDING',
      mensaje: String(mensajeUsuario ?? ''),
      respuesta_ia: interpretacion.reply,
      metadata,
    });
    return {
      saved: false,
      reply: interpretacion.reply,
      pregunta: serializarPregunta(pregunta, sesion.paso_actual, totalSteps(sesion.respuestas), sesion.respuestas),
    };
  }

  const avance = await responderPaso(sesionId, interpretacion.value, {
    permitirNombreUnico: identidadReconocida,
  });
  await supabaseAdmin.from('interacciones_agente').insert({
    empresa_id: sesion.empresa_id,
    sesion_id: sesion.id,
    fase: 'ONBOARDING',
    mensaje: String(mensajeUsuario ?? ''),
    respuesta_ia: interpretacion.reply,
    metadata,
  });

  return { ...avance, saved: true, reply: interpretacion.reply };
}

export async function generarDiagnostico(sesionId, publicUserId) {
  const sesion = await obtenerSesion(sesionId, publicUserId);
  // Cada respuesta ya fue validada antes de avanzar el paso. Cuando la
  // sesión está marcada como completada, repetir aquí la validación sobre
  // la lista dinámica puede reintroducir preguntas que cambiaron de
  // visibilidad por una inferencia o una respuesta anterior.
  if (!sesion.completada) {
    const visibles = getVisibleQuestions(sesion.respuestas);
    const faltantes = visibles.filter((q) => q.required && sesion.respuestas[q.id] === undefined);
    if (faltantes.length > 0) {
      throw new ApiError(400, 'Aún faltan respuestas obligatorias para generar el diagnóstico', {
        faltantes: faltantes.map((q) => q.id),
      });
    }
  }

  const { data: diagnosticoExistente, error: diagnosticoExistenteError } = await supabaseAdmin
    .from('diagnosticos')
    .select('id')
    .eq('sesion_id', sesion.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (diagnosticoExistenteError) {
    throw new ApiError(500, 'No se pudo verificar el diagnóstico existente', diagnosticoExistenteError.message);
  }
  if (diagnosticoExistente) return obtenerDiagnosticoCompleto(diagnosticoExistente.id, publicUserId);

  const empresa = await empresaService.obtenerEmpresa(sesion.empresa_id);
  const sector = await catalogoService.obtenerSectorPorNombre(sesion.respuestas.sector_texto);

  if (sector && empresa.sector_id !== sector.id) {
    await empresaService.actualizarEmpresa(empresa.id, { sector_id: sector.id });
  }

  // Etapas 7-9: rúbrica de capacidades, elegibilidad, riesgo
  // financiero, nivel de madurez y detector de brechas.
  const diagnostico = calcularDiagnostico(sesion.respuestas, sector?.peso_ejes);
  // Etapa 3: clasificación sectorial con porcentaje de afinidad.
  const clasificacion = clasificarOrganizacion(sesion.respuestas);
  // Etapa 6: cadena servicio -> capacidad -> problema -> necesidad
  // pública -> impacto -> comprador público.
  const perfilamiento = perfilarOferta(sesion.respuestas, clasificacion);
  // Etapa 10: qué entidades podrían requerir estos servicios y por qué.
  const mapaEntidades = construirMapaEntidades({
    compradores: perfilamiento.compradores,
    respuestas: sesion.respuestas,
    diagnostico,
  });
  // Etapa 4: tags estandarizados que permiten agrupar la organización
  // con sus pares dentro del ecosistema IDEAPRO.
  const tags = generarTags({
    respuestas: sesion.respuestas,
    clasificacion,
    perfilamiento,
    mapaEntidades,
    diagnostico,
  });
  // Etapa 11: relaciones empresariales contra el resto del ecosistema.
  const relaciones = await construirRelacionesEmpresariales({
    empresaId: empresa.id,
    respuestas: sesion.respuestas,
    clasificacion,
    perfilamiento,
    tags,
    diagnostico,
  });
  const entrevista = construirEntrevista(sesion.respuestas, sesion.mensajes_raw);

  const datosDiagnostico = {
    empresa_id: empresa.id,
    sesion_id: sesion.id,
    score_oferta: diagnostico.scores.oferta,
    score_experiencia: diagnostico.scores.experiencia,
    score_operativa: diagnostico.scores.operativa,
    score_legal: diagnostico.scores.legal,
    score_financiera: diagnostico.scores.financiera,
    score_comercial: diagnostico.scores.comercial,
    nivel_madurez_global: diagnostico.nivelMadurezGlobal,
    eje_critico_identificado: diagnostico.ejeCritico,
    brechas: diagnostico.brechas,
    dimensiones_ideapro: diagnostico.dimensionesIdeapro,
    fase_ruta: 'PRE',
    radar_data: diagnostico.radarData,
    resumen_conversacion: JSON.stringify(sesion.respuestas),
    // Columnas del protocolo Nexus. Si la migración aún no se aplicó,
    // el fallback de esquema las descarta y el diagnóstico se guarda
    // igual (ver esquemaDiagnosticoNuevoNoDisponible).
    nivel_madurez_numero: diagnostico.nivelMadurez.nivel,
    estado_elegibilidad: diagnostico.elegibilidad.estado,
    elegibilidad: diagnostico.elegibilidad,
    riesgo_financiero: diagnostico.riesgoFinanciero.nivel,
    riesgo_financiero_detalle: diagnostico.riesgoFinanciero,
    brechas_por_familia: diagnostico.brechasPorFamilia,
    clasificacion_sectorial: clasificacion,
    perfilamiento_oferta: perfilamiento,
    entidades_objetivo: mapaEntidades,
    tags: tags.tags,
    organizaciones_similares: relaciones,
  };

  let { data: diagnosticoRow, error: errDiag } = await supabaseAdmin
    .from('diagnosticos')
    .insert(datosDiagnostico)
    .select()
    .single();

  // Primer reintento: base sin la migración Nexus, pero con el esquema
  // 2026. Se conservan brechas y dimensiones_ideapro.
  let soportaNexus = true;
  if (errDiag && esquemaNexusNoDisponible(errDiag)) {
    soportaNexus = false;
    console.warn('[diagnostico] columnas del protocolo Nexus no disponibles; se guarda el diagnóstico base');
    const datosSinNexus = { ...datosDiagnostico };
    for (const columna of COLUMNAS_NEXUS) delete datosSinNexus[columna];
    ({ data: diagnosticoRow, error: errDiag } = await supabaseAdmin
      .from('diagnosticos')
      .insert(datosSinNexus)
      .select()
      .single());
  }

  // Segundo reintento: base con el esquema original, anterior a 2026.
  if (errDiag && esquemaDiagnosticoNuevoNoDisponible(errDiag)) {
    soportaNexus = false;
    const datosLegacy = { ...datosDiagnostico };
    for (const columna of [...COLUMNAS_NEXUS, ...COLUMNAS_2026]) delete datosLegacy[columna];
    datosLegacy.nivel_madurez_global = NIVEL_LEGACY[diagnostico.nivelMadurezGlobal]
      || diagnostico.nivelMadurezGlobal;
    ({ data: diagnosticoRow, error: errDiag } = await supabaseAdmin
      .from('diagnosticos')
      .insert(datosLegacy)
      .select()
      .single());
  }

  if (errDiag?.code === '23505') {
    const { data: diagnosticoConcurrente, error: errorConcurrente } = await supabaseAdmin
      .from('diagnosticos')
      .select('id')
      .eq('sesion_id', sesion.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!errorConcurrente && diagnosticoConcurrente) {
      return obtenerDiagnosticoCompleto(diagnosticoConcurrente.id, publicUserId);
    }
  }

  if (errDiag) throw new ApiError(500, 'No se pudo guardar el diagnóstico', errDiag.message);

  const [catalogo, dependencias, tiposOportunidad, oportunidadesReales] = await Promise.all([
    catalogoService.listarCatalogoActivo(),
    catalogoService.listarDependencias(),
    catalogoService.listarTiposOportunidad(),
    catalogoService.listarOportunidadesReales(),
  ]);

  const rutaBase = construirRutaRecomendada({ diagnostico, catalogo, dependencias });
  const resumenCandidato = await generarResumenIA({
    empresa,
    diagnostico,
    rutaTop: rutaBase.slice(0, 1),
    clasificacion,
    perfilamiento,
    mapaEntidades,
    tags,
    relaciones,
  });
  const filtroIA = await filtrarMejorRespuesta({
    empresa,
    diagnostico,
    ruta: rutaBase,
    resumenCandidato,
    clasificacion,
    perfilamiento,
    mapaEntidades,
    tags,
    relaciones,
    entrevista,
  });
  const ruta = reordenarRutaConFiltro(rutaBase, filtroIA?.servicioIds);
  const resumenIA = filtroIA?.resumen || resumenCandidato;
  if (filtroIA?.fuente) {
    console.log(`[iaFilter] Resumen final con fuente=${filtroIA.fuente}`);
  }

  if (ruta.length > 0) {
    const { error: errRuta } = await supabaseAdmin.from('ruta_recomendada').insert(
      ruta.map((item) => ({
        diagnostico_id: diagnosticoRow.id,
        servicio_id: item.servicio_id,
        orden_prioridad: item.orden_prioridad,
        justificacion_ia: item.justificacion,
      }))
    );
    if (errRuta) throw new ApiError(500, 'No se pudo guardar la ruta recomendada', errRuta.message);
  }

  const encajes = calcularEncajeOportunidades(diagnostico, tiposOportunidad, sesion.respuestas.sector_texto);
  if (encajes.length > 0) {
    const { error: errEncaje } = await supabaseAdmin.from('encaje_oportunidad').insert(
      encajes.map((e) => ({
        diagnostico_id: diagnosticoRow.id,
        oportunidad_id: e.oportunidad.id,
        porcentaje_encaje: e.porcentajeEncaje,
        brechas_identificadas: e.brechas,
      }))
    );
    if (errEncaje) throw new ApiError(500, 'No se pudo guardar el encaje de oportunidades', errEncaje.message);
  }

  const matchesReales = identificarOportunidadesReales(
    diagnostico,
    oportunidadesReales,
    {
      ...sesion.respuestas,
      documentos: (await documentService.listarDocumentos(diagnosticoRow.id, publicUserId))
        .filter((documento) => documento.estado_vigencia !== 'vencido')
        .map((documento) => documento.categoria || documento.nombre_original),
    },
    empresa
  );
  let recomendacionesDisponibles = true;
  if (matchesReales.length > 0) {
    const { data: existentes, error: errExistentes } = await supabaseAdmin
      .from('postulaciones_oportunidad')
      .select('oportunidad_id')
      .eq('empresa_id', empresa.id)
      .in('oportunidad_id', matchesReales.map(({ oportunidad }) => oportunidad.id));
    if (catalogoService.tablaNoDisponible(errExistentes, 'postulaciones_oportunidad')) {
      recomendacionesDisponibles = false;
      console.warn('[oportunidades] tabla de recomendaciones no disponible; se omiten recomendaciones reales');
    } else if (errExistentes) {
      throw new ApiError(500, 'No se pudieron verificar recomendaciones existentes', errExistentes.message);
    }

    const idsExistentes = new Set((existentes || []).map(({ oportunidad_id }) => oportunidad_id));
    const recomendaciones = matchesReales.filter(({ oportunidad }) => !idsExistentes.has(oportunidad.id));
    if (recomendacionesDisponibles && recomendaciones.length > 0) {
      const { data: recomendacionesGuardadas, error: errRecomendaciones } = await supabaseAdmin.from('postulaciones_oportunidad').insert(
        recomendaciones.map((match) => ({
          empresa_id: empresa.id,
          oportunidad_id: match.oportunidad.id,
          diagnostico_id: diagnosticoRow.id,
          fase: 'PRE',
          estado: 'recomendada',
          porcentaje_encaje: match.porcentajeEncaje,
          brechas: match.brechas,
          perfilamiento: {
            fortalezas: match.fortalezas,
            conveniencia: match.conveniencia,
            accion_recomendada: match.accionRecomendada,
            filtros_aplicados: match.filtrosAplicados,
          },
        }))
      ).select('id, oportunidad_id');
      if (catalogoService.tablaNoDisponible(errRecomendaciones, 'postulaciones_oportunidad')) {
        console.warn('[oportunidades] tabla de recomendaciones no disponible; se omiten recomendaciones reales');
      } else if (errRecomendaciones) {
        throw new ApiError(500, 'No se pudieron guardar recomendaciones reales', errRecomendaciones.message);
      } else {
        await Promise.all((recomendacionesGuardadas || []).map((postulacion) => {
          const match = recomendaciones.find((item) => item.oportunidad.id === postulacion.oportunidad_id);
          return alertService.programarAlertasOportunidad({
            empresaId: empresa.id,
            oportunidad: match.oportunidad,
            postulacionId: postulacion.id,
            brechas: match.brechas,
          });
        }));
      }
    }
  }

  // Etapa 14: plan de acción 30/60/90/180 construido sobre las brechas
  // reales, la ruta ya priorizada y la entidad de entrada sugerida.
  const planAccion = construirPlanAccion({
    respuestas: sesion.respuestas,
    diagnostico,
    ruta,
    mapaEntidades,
  });

  // Etapa 15: reporte final con las 20 secciones del protocolo.
  const reporteFinal = construirReporteFinal({
    empresa,
    respuestas: sesion.respuestas,
    diagnostico,
    clasificacion,
    perfilamiento,
    mapaEntidades,
    ruta,
    planAccion,
    encaje: [...matchesReales, ...encajes],
    resumenIA,
    tags,
    relaciones,
  });

  const actualizacion = { resumen_ia: resumenIA };
  if (soportaNexus) {
    actualizacion.plan_accion = planAccion;
    actualizacion.reporte_final = reporteFinal;
  }
  const { error: errActualizacion } = await supabaseAdmin
    .from('diagnosticos')
    .update(actualizacion)
    .eq('id', diagnosticoRow.id);
  if (errActualizacion && esquemaNexusNoDisponible(errActualizacion)) {
    await supabaseAdmin.from('diagnosticos').update({ resumen_ia: resumenIA }).eq('id', diagnosticoRow.id);
  } else if (errActualizacion) {
    throw new ApiError(500, 'No se pudo guardar el resumen del diagnóstico', errActualizacion.message);
  }

  const resultado = await obtenerDiagnosticoCompleto(diagnosticoRow.id);
  // Si la base no soporta las columnas Nexus, el reporte igual viaja al
  // frontend en esta respuesta: el diagnóstico nunca se degrada para el
  // usuario, solo su persistencia. La reconstrucción vive en
  // obtenerDiagnosticoCompleto para que aplique también al revisitar
  // el diagnóstico y al regenerarlo (que devuelve el existente).
  return resultado;
}

export async function conversarDiagnostico(diagnosticoId, mensajeUsuario, publicUserId) {
  const mensaje = String(mensajeUsuario ?? '').trim();
  if (!mensaje || esPreguntaSinContexto(mensaje)) {
    return {
      reply: 'Necesito que me preguntes algo concreto sobre tu diagnóstico, por ejemplo: una brecha, un eje, una recomendación o una pregunta sobre tu ruta de crecimiento.',
      confidence: 0,
    };
  }

  const resultado = await obtenerDiagnosticoCompleto(diagnosticoId, publicUserId);
  const documentos = await documentService.listarDocumentos(diagnosticoId, publicUserId);
  const diagnostico = resultado.diagnostico;
  const empresa = diagnostico.empresas;
  const { data: sesionContexto, error: sesionContextoError } = await supabaseAdmin
    .from('sesiones')
    .select('respuestas, mensajes_raw')
    .eq('id', diagnostico.sesion_id)
    .maybeSingle();
  if (sesionContextoError) throw new ApiError(500, 'No se pudo cargar el contexto de la entrevista', sesionContextoError.message);
  const { data: historial, error: historialError } = await supabaseAdmin
    .from('interacciones_agente')
    .select('fase, mensaje, respuesta_ia, metadata, created_at')
    .eq('empresa_id', empresa?.id)
    .order('created_at', { ascending: true })
    .limit(40);
  if (historialError) throw new ApiError(500, 'No se pudo cargar el historial del agente', historialError.message);
  const contexto = {
    fase: 'DIAGNOSTICO_CHAT',
    diagnostico_id: diagnostico.id,
    sesion_id: diagnostico.sesion_id,
    mensaje_usuario: String(mensajeUsuario ?? ''),
    historial: historial || [],
    documentos: documentos.map((documento) => ({
      nombre: documento.nombre_original,
      tipo: documento.mime_type,
      contenido: documento.texto_extraido,
    })),
    entrevista: construirEntrevista(sesionContexto?.respuestas || {}, sesionContexto?.mensajes_raw || []),
    empresa: {
      id: empresa?.id,
      nombre: empresa?.nombre,
    },
    diagnostico: {
      indiceIdeapro: diagnostico.indice_ideapro,
      nivelMadurezGlobal: diagnostico.nivel_madurez_global,
      nivelMadurezNumero: diagnostico.nivel_madurez_numero,
      ejeCritico: diagnostico.eje_critico_identificado,
      scores: {
        oferta: diagnostico.score_oferta,
        experiencia: diagnostico.score_experiencia,
        operativa: diagnostico.score_operativa,
        legal: diagnostico.score_legal,
        financiera: diagnostico.score_financiera,
        comercial: diagnostico.score_comercial,
      },
      dimensionesIdeapro: diagnostico.dimensiones_ideapro || {},
      resumen: diagnostico.resumen_ia,
      brechas: diagnostico.brechas || [],
      radarMadurez: diagnostico.radar_data || {},
      // Contexto del protocolo Nexus: sin esto el chat post-diagnóstico
      // no puede explicar la elegibilidad, la clasificación ni el plan,
      // que es justamente lo que la organización pregunta.
      brechasPorFamilia: diagnostico.brechas_por_familia || [],
      elegibilidad: diagnostico.elegibilidad || null,
      riesgoElegibilidad: diagnostico.elegibilidad?.riesgos || [],
      riesgoFinanciero: diagnostico.riesgo_financiero_detalle || null,
      nivelMadurez: {
        global: diagnostico.nivel_madurez_global,
        numero: diagnostico.nivel_madurez_numero,
      },
      nivelMadurezDetalle: diagnostico.nivel_madurez_detalle || null,
      clasificacion: diagnostico.clasificacion_sectorial || null,
      perfilamiento: diagnostico.perfilamiento_oferta || null,
      entidadesObjetivo: diagnostico.entidades_objetivo || null,
      planAccion: diagnostico.plan_accion || null,
      reporteFinal: diagnostico.reporte_final || null,
      tags: diagnostico.tags || [],
      organizacionesSimilares: diagnostico.organizaciones_similares || null,
    },
    ruta: (resultado.ruta || []).map((item) => ({
      servicio_id: item.servicio_id,
      nombre: item.catalogo_servicios?.nombre_servicio,
      tipo: item.catalogo_servicios?.tipo_servicio,
      justificacion: item.justificacion_ia,
      orden_prioridad: item.orden_prioridad,
    })),
    encaje: resultado.encaje || [],
    oportunidadesPriorizadas: resultado.encaje || [],
    rutaCrecimientoRecomendada: resultado.ruta || [],
    servicios: (resultado.ruta || []).map((item) => item.catalogo_servicios).filter(Boolean),
    oportunidad: resultado.encaje?.[0] || null,
  };

  let respuesta;
  try {
    respuesta = await interpretarMensaje(contexto);
  } catch (error) {
    console.warn('[n8nChat] fallback en diagnóstico:', error.message);
  }
  if (!respuesta) {
    respuesta = {
      reply: generarRespuestaDiagnosticoLocal(contexto, String(mensajeUsuario ?? '')),
      next_action: 'finish',
      value: null,
      confidence: 0.7,
    };
  }
  if (!respuestaIAConfiable(respuesta) || !respuestaTieneEvidenciaNumerica(respuesta.reply, contexto)) {
    const local = generarRespuestaDiagnosticoLocal(contexto, String(mensajeUsuario ?? ''));
    const usandoContexto = local && local !== RESPUESTA_SEGURA_CHAT && /\d|madurez|riesgo|ruta|eje|indicador/i.test(local);
    respuesta = {
      reply: usandoContexto ? local : RESPUESTA_SEGURA_CHAT,
      next_action: 'ask_clarification',
      value: null,
      confidence: Number(respuesta?.confidence) || 0.7,
    };
  }

  const { error } = await supabaseAdmin.from('interacciones_agente').insert({
    empresa_id: empresa?.id,
    sesion_id: diagnostico.sesion_id,
    fase: 'DIAGNOSTICO_CHAT',
    mensaje: String(mensajeUsuario ?? ''),
    respuesta_ia: respuesta.reply,
    metadata: {
      diagnostico_id: diagnostico.id,
      confidence: respuesta.confidence,
      origen: env.n8nChatWebhookUrl ? 'n8n' : 'fallback',
    },
  });
  if (error) throw new ApiError(500, 'No se pudo guardar la interacción', error.message);

  return { reply: respuesta.reply, confidence: respuesta.confidence };
}

export async function obtenerEvolucionDiagnostico(diagnosticoId, publicUserId) {
  const actual = await obtenerDiagnosticoCompleto(diagnosticoId, publicUserId);
  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('id, created_at, indice_ideapro, nivel_madurez_global, score_oferta, score_experiencia, score_operativa, score_legal, score_financiera, score_comercial')
    .eq('empresa_id', actual.diagnostico.empresa_id)
    .order('created_at', { ascending: true });
  if (error) throw new ApiError(500, 'No se pudo cargar la evolución del diagnóstico', error.message);

  const ejes = ['oferta', 'experiencia', 'operativa', 'legal', 'financiera', 'comercial'];
  return (data || []).map((diagnostico, indice, historico) => {
    const anterior = historico[indice - 1];
    const cambios = Object.fromEntries(ejes.map((eje) => [
      eje,
      anterior ? diagnostico[`score_${eje}`] - anterior[`score_${eje}`] : 0,
    ]));
    return { ...diagnostico, cambios, esActual: diagnostico.id === diagnosticoId };
  });
}

// Reconstruye las salidas del protocolo Nexus que no estén persistidas.
// Se ejecuta al LEER el diagnóstico, no al escribirlo, por dos razones:
//   1. Cubre por igual la primera generación, el revisitado del reporte
//      y la regeneración idempotente (que devuelve el existente). Antes
//      solo la primera generación traía los datos y volver al reporte
//      lo mostraba vacío.
//   2. Hace irrelevante si migration_nexus_ai.sql se aplicó o no: si
//      las columnas existen se leen, y si no, se recalculan.
// Es barato: los motores son funciones puras sobre las respuestas ya
// guardadas en la sesión; el único costo extra es leer esa fila.
async function reconstruirProtocoloNexus(diagnostico, ruta, encaje) {
  if (diagnostico.reporte_final?.secciones?.length) return diagnostico;

  let respuestas = null;
  if (diagnostico.sesion_id) {
    const { data: sesion } = await supabaseAdmin
      .from('sesiones')
      .select('respuestas')
      .eq('id', diagnostico.sesion_id)
      .maybeSingle();
    respuestas = sesion?.respuestas || null;
  }
  if (!respuestas && diagnostico.resumen_conversacion) {
    try {
      respuestas = JSON.parse(diagnostico.resumen_conversacion);
    } catch {
      respuestas = null;
    }
  }
  if (!respuestas || Object.keys(respuestas).length === 0) return diagnostico;

  const sector = await catalogoService.obtenerSectorPorNombre(respuestas.sector_texto).catch(() => null);
  const calculado = calcularDiagnostico(respuestas, sector?.peso_ejes);
  const clasificacion = clasificarOrganizacion(respuestas);
  const perfilamiento = perfilarOferta(respuestas, clasificacion);
  const mapaEntidades = construirMapaEntidades({
    compradores: perfilamiento.compradores,
    respuestas,
    diagnostico: calculado,
  });
  const tags = (Array.isArray(diagnostico.tags) && diagnostico.tags.length > 0)
    ? { tags: diagnostico.tags, lista: diagnostico.tags.map((t) => t?.tag).filter(Boolean) }
    : generarTags({ respuestas, clasificacion, perfilamiento, mapaEntidades, diagnostico: calculado });
  const relaciones = !vacio(diagnostico.organizaciones_similares)
    ? diagnostico.organizaciones_similares
    : await construirRelacionesEmpresariales({
      empresaId: diagnostico.empresa_id,
      respuestas,
      clasificacion,
      perfilamiento,
      tags,
      diagnostico: calculado,
    });

  // La ruta viene de la base con el servicio en `catalogo_servicios`;
  // los motores la esperan en `servicio`.
  const rutaNormalizada = (ruta || []).map((item) => ({
    servicio_id: item.servicio_id,
    servicio: item.catalogo_servicios,
    orden_prioridad: item.orden_prioridad,
    justificacion: item.justificacion_ia,
  }));

  const planAccion = construirPlanAccion({
    respuestas,
    diagnostico: calculado,
    ruta: rutaNormalizada,
    mapaEntidades,
  });

  const reporteFinal = construirReporteFinal({
    empresa: diagnostico.empresas || {},
    respuestas,
    diagnostico: calculado,
    clasificacion,
    perfilamiento,
    mapaEntidades,
    ruta: rutaNormalizada,
    planAccion,
    encaje: encaje || [],
    resumenIA: diagnostico.resumen_ia || '',
    tags,
    relaciones,
  });

  return {
    ...diagnostico,
    plan_accion: vacio(diagnostico.plan_accion) ? planAccion : diagnostico.plan_accion,
    reporte_final: reporteFinal,
    clasificacion_sectorial: vacio(diagnostico.clasificacion_sectorial) ? clasificacion : diagnostico.clasificacion_sectorial,
    perfilamiento_oferta: vacio(diagnostico.perfilamiento_oferta) ? perfilamiento : diagnostico.perfilamiento_oferta,
    entidades_objetivo: vacio(diagnostico.entidades_objetivo) ? mapaEntidades : diagnostico.entidades_objetivo,
    tags: tags.tags,
    organizaciones_similares: relaciones,
    brechas_por_familia: diagnostico.brechas_por_familia?.length ? diagnostico.brechas_por_familia : calculado.brechasPorFamilia,
    elegibilidad: vacio(diagnostico.elegibilidad) ? calculado.elegibilidad : diagnostico.elegibilidad,
    riesgo_financiero_detalle: vacio(diagnostico.riesgo_financiero_detalle) ? calculado.riesgoFinanciero : diagnostico.riesgo_financiero_detalle,
    riesgo_financiero: diagnostico.riesgo_financiero || calculado.riesgoFinanciero.nivel,
    estado_elegibilidad: diagnostico.estado_elegibilidad && diagnostico.estado_elegibilidad !== 'en_revision'
      ? diagnostico.estado_elegibilidad
      : calculado.elegibilidad.estado,
    nivel_madurez_numero: diagnostico.nivel_madurez_numero || calculado.nivelMadurez.nivel,
  };
}

function vacio(valor) {
  return !valor || (typeof valor === 'object' && Object.keys(valor).length === 0);
}

// =====================================================================
// ETAPA 11 · Relaciones empresariales
// ---------------------------------------------------------------------
// Compara la organización contra el resto del ecosistema ya
// diagnosticado. Se lee el diagnóstico más reciente de cada empresa y,
// si la base todavía no guarda las salidas del protocolo (bases sin la
// migración), el perfil comparable se RECALCULA a partir de las
// respuestas guardadas: la comparación nunca depende del esquema.
//
// Solo viaja información de perfil (nombre, tipo, territorio, nivel):
// ningún dato de contacto ni financiero sale de aquí.
// =====================================================================

const CAMPOS_ECOSISTEMA = 'empresa_id, created_at, score_financiera, nivel_madurez_numero, clasificacion_sectorial, perfilamiento_oferta, tags, resumen_conversacion, empresas!inner(id, nombre, tipo_organizacion, ubicacion_ciudad, ubicacion_departamento, sector_texto, tiene_rup, experiencia_previa_contratos)';
// Reintento para bases sin la migración Nexus: sin columnas nuevas de
// diagnosticos ni de empresas. El perfil comparable se recalcula.
const CAMPOS_ECOSISTEMA_BASE = 'empresa_id, created_at, score_financiera, resumen_conversacion, empresas!inner(id, nombre, ubicacion_ciudad, ubicacion_departamento, sector_texto, tiene_rup, experiencia_previa_contratos)';

function perfilDeFilaEcosistema(fila) {
  const empresa = fila.empresas;
  if (!empresa?.nombre) return null;
  // Las empresas en borrador todavía no son comparables con nadie.
  if (/^empresa sin nombre/i.test(empresa.nombre)) return null;

  let respuestas = {};
  try {
    respuestas = fila.resumen_conversacion ? JSON.parse(fila.resumen_conversacion) : {};
  } catch {
    respuestas = {};
  }

  const clasificacion = vacio(fila.clasificacion_sectorial)
    ? clasificarOrganizacion(respuestas)
    : fila.clasificacion_sectorial;
  const perfilamiento = vacio(fila.perfilamiento_oferta)
    ? perfilarOferta(respuestas, clasificacion)
    : fila.perfilamiento_oferta;
  const tags = (Array.isArray(fila.tags) && fila.tags.length > 0)
    ? fila.tags
    : generarTags({ respuestas, clasificacion, perfilamiento }).tags;

  return perfilComparable({
    empresaId: empresa.id,
    nombre: empresa.nombre,
    tipoOrganizacion: empresa.tipo_organizacion || respuestas.tipo_organizacion || null,
    ciudad: empresa.ubicacion_ciudad || respuestas.ubicacion_ciudad || null,
    departamento: empresa.ubicacion_departamento || respuestas.ubicacion_departamento || null,
    sector: empresa.sector_texto || respuestas.sector_texto || null,
    clasificacion,
    tags,
    perfilamiento,
    nivelMadurez: fila.nivel_madurez_numero || null,
    capacidades: {
      rup: empresa.tiene_rup === true,
      experienciaPublica: empresa.experiencia_previa_contratos === true,
      capacidadFinanciera: (fila.score_financiera ?? 0) >= 60,
      cobertura: respuestas.cobertura_territorial || null,
    },
  });
}

async function cargarEcosistemaComparable(empresaId) {
  const consultar = (campos) => supabaseAdmin
    .from('diagnosticos')
    .select(campos)
    .neq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(150);

  let { data, error } = await consultar(CAMPOS_ECOSISTEMA);
  if (error) {
    ({ data, error } = await consultar(CAMPOS_ECOSISTEMA_BASE));
  }
  if (error) {
    console.warn('[relaciones] no se pudo leer el ecosistema:', error.message);
    return [];
  }

  // Una organización puede tener varios diagnósticos: solo cuenta el
  // más reciente, que es el que refleja sus capacidades de hoy.
  const vistas = new Set();
  const perfiles = [];
  for (const fila of data || []) {
    if (!fila.empresa_id || vistas.has(fila.empresa_id)) continue;
    vistas.add(fila.empresa_id);
    const perfil = perfilDeFilaEcosistema(fila);
    if (perfil) perfiles.push(perfil);
  }
  return perfiles;
}

async function construirRelacionesEmpresariales({ empresaId, respuestas, clasificacion, perfilamiento, tags, diagnostico }) {
  try {
    const base = perfilComparable({
      empresaId,
      nombre: respuestas.nombre,
      tipoOrganizacion: respuestas.tipo_organizacion || null,
      ciudad: respuestas.ubicacion_ciudad || null,
      departamento: respuestas.ubicacion_departamento || null,
      sector: respuestas.sector_texto || null,
      clasificacion,
      tags: tags?.tags || [],
      perfilamiento,
      nivelMadurez: diagnostico?.nivelMadurez?.nivel || null,
      capacidades: {
        rup: respuestas.tiene_rup === true,
        experienciaPublica: respuestas.experiencia_previa_contratos === true,
        capacidadFinanciera: (diagnostico?.scores?.financiera ?? 0) >= 60,
        cobertura: respuestas.cobertura_territorial || null,
      },
    });
    const candidatas = await cargarEcosistemaComparable(empresaId);
    return calcularRelacionesEmpresariales(base, candidatas);
  } catch (error) {
    // La comparación es valor agregado: si falla, el diagnóstico se
    // entrega igual y la sección lo dice explícitamente.
    console.warn('[relaciones] no se pudieron calcular:', error.message);
    return { organizaciones: [], evaluadas: 0, nota: 'La comparación con el ecosistema no estuvo disponible al generar este diagnóstico.' };
  }
}

export async function obtenerDiagnosticoCompleto(diagnosticoId, publicUserId) {
  const { data: diagnostico, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('*, empresas(id, nombre, correo_contacto, sector_id)')
    .eq('id', diagnosticoId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'Error consultando el diagnóstico', error.message);
  if (!diagnostico) throw new ApiError(404, 'Diagnóstico no encontrado');

  if (publicUserId) {
    const { data: sesion, error: sesionError } = await supabaseAdmin
      .from('sesiones')
      .select('usuario_publico_id')
      .eq('id', diagnostico.sesion_id)
      .maybeSingle();
    if (sesionError) throw new ApiError(500, 'No se pudo verificar el diagnóstico', sesionError.message);
    if (!sesion || sesion.usuario_publico_id !== publicUserId) {
      throw new ApiError(404, 'Diagnóstico no encontrado');
    }
  }

  const { data: ruta, error: errRuta } = await supabaseAdmin
    .from('ruta_recomendada')
    .select('*, catalogo_servicios(*)')
    .eq('diagnostico_id', diagnosticoId)
    .order('orden_prioridad', { ascending: true });
  if (errRuta) throw new ApiError(500, 'Error consultando la ruta recomendada', errRuta.message);

  const { data: encaje, error: errEncaje } = await supabaseAdmin
    .from('encaje_oportunidad')
    .select('*, tipos_oportunidad(*)')
    .eq('diagnostico_id', diagnosticoId)
    .order('porcentaje_encaje', { ascending: false });
  if (errEncaje) throw new ApiError(500, 'Error consultando el encaje de oportunidades', errEncaje.message);

  const { data: recomendaciones, error: errRecomendaciones } = await supabaseAdmin
    .from('postulaciones_oportunidad')
    .select('*, oportunidades(*)')
    .eq('empresa_id', diagnostico.empresa_id)
    .eq('diagnostico_id', diagnosticoId)
    .eq('fase', 'PRE')
    .order('porcentaje_encaje', { ascending: false });
  if (catalogoService.tablaNoDisponible(errRecomendaciones, 'postulaciones_oportunidad')) {
    return { diagnostico: await reconstruirProtocoloNexus(diagnostico, ruta, encaje), ruta, encaje };
  }
  if (errRecomendaciones) throw new ApiError(500, 'Error consultando recomendaciones reales', errRecomendaciones.message);

  const encajeReal = (recomendaciones || []).map((item) => ({
    ...item,
    porcentaje_encaje: item.porcentaje_encaje || 0,
    brechas_identificadas: item.brechas || [],
    oportunidad_real: item.oportunidades,
    fortalezas: item.perfilamiento?.fortalezas || [],
    conveniencia: item.perfilamiento?.conveniencia,
    accion_recomendada: item.perfilamiento?.accion_recomendada,
  }));

  const encajeCompleto = [...encajeReal, ...(encaje || [])];
  return {
    diagnostico: await reconstruirProtocoloNexus(diagnostico, ruta, encajeCompleto),
    ruta,
    encaje: encajeCompleto,
  };
}
