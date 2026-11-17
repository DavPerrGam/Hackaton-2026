// =====================================================================
// ETAPA 3 · Clasificacion inteligente con porcentaje de afinidad
// ---------------------------------------------------------------------
// El protocolo Nexus pide que el agente deduzca -a partir de TODA la
// conversacion, no de una sola respuesta- a que categorias tematicas
// pertenece la organizacion, aceptando pertenencia multiple y
// asignando un porcentaje de afinidad (ej: Tecnologia 90%, GovTech
// 70%, Transformacion Digital 95%).
//
// Implementacion: lexico ponderado por categoria. Cada categoria
// declara terminos con un peso; el texto del perfil (sector, producto,
// problema que resuelve, diferenciador, objetivo, entidades objetivo)
// se normaliza y se busca cada termino. La afinidad final combina:
//   - evidencia lexica (hasta 70 puntos),
//   - senales estructurales (sector declarado, tipo de organizacion y
//     madurez tecnologica) que suman hasta 30 puntos.
// Es determinista y auditable: siempre se devuelve que termino disparo
// la categoria, para poder explicarselo a la organizacion.
// =====================================================================

const CATEGORIAS = [
  {
    id: 'tecnologia', nombre: 'Tecnología',
    terminos: { software: 3, plataforma: 3, aplicacion: 2, app: 2, sistema: 2, tecnologia: 3, digital: 2, datos: 2, nube: 2, ti: 2, informatica: 3, hardware: 2, red: 1, ciberseguridad: 3, api: 2, desarrollo: 2 },
  },
  {
    id: 'govtech', nombre: 'GovTech',
    terminos: { govtech: 5, 'gobierno digital': 5, 'sector publico': 2, estatal: 2, alcaldia: 2, gobernacion: 2, tramite: 3, 'ventanilla unica': 4, interoperabilidad: 4, 'gestion publica': 3, entidad: 1 },
  },
  {
    id: 'civictech', nombre: 'CivicTech',
    terminos: { civictech: 5, ciudadano: 3, participacion: 3, comunidad: 2, veeduria: 4, transparencia: 3, 'datos abiertos': 4, social: 1 },
  },
  {
    id: 'transformacion_digital', nombre: 'Transformación digital',
    terminos: { automatizacion: 4, automatizar: 4, digitalizacion: 5, digitalizar: 5, modernizacion: 3, 'transformacion digital': 5, 'sin papel': 3, eficiencia: 2, proceso: 1, flujo: 1, integracion: 2 },
  },
  {
    id: 'educacion', nombre: 'Educación',
    terminos: { educacion: 4, colegio: 3, escuela: 3, universidad: 3, estudiante: 3, docente: 3, pedagogic: 3, curriculo: 3, aprendizaje: 2, academic: 2 },
  },
  {
    id: 'formacion', nombre: 'Formación y capacitación',
    terminos: { formacion: 4, capacitacion: 4, curso: 3, diplomado: 4, entrenamiento: 3, taller: 2, certificacion: 2, competencia: 2 },
  },
  {
    id: 'ingenieria', nombre: 'Ingeniería',
    terminos: { ingenieria: 4, diseno: 2, calculo: 2, estructural: 3, mecanic: 3, electric: 3, civil: 3, interventoria: 3, obra: 2 },
  },
  {
    id: 'consultoria', nombre: 'Consultoría',
    terminos: { consultoria: 5, asesoria: 4, consultor: 4, diagnostico: 2, acompanamiento: 3, estudio: 2, auditoria: 3, estrategia: 2 },
  },
  {
    id: 'planeacion', nombre: 'Planeación territorial',
    terminos: { planeacion: 5, 'plan de desarrollo': 5, ordenamiento: 4, pot: 4, prospectiva: 4, 'plan estrategico': 4, formulacion: 3, 'banco de proyectos': 4 },
  },
  {
    id: 'infraestructura', nombre: 'Infraestructura',
    terminos: { infraestructura: 5, construccion: 4, obra: 3, via: 3, edificacion: 4, mantenimiento: 2, acueducto: 3, alcantarillado: 3, pavimento: 3 },
  },
  {
    id: 'salud', nombre: 'Salud',
    terminos: { salud: 5, medic: 4, hospital: 4, clinic: 4, ese: 3, paciente: 3, farmac: 3, invima: 3, enfermer: 3, dispositivo: 2 },
  },
  {
    id: 'sostenibilidad', nombre: 'Sostenibilidad',
    terminos: { sostenib: 5, sostenible: 5, ods: 4, circular: 3, huella: 3, carbono: 4, reciclaje: 3, residuo: 3 },
  },
  {
    id: 'medio_ambiente', nombre: 'Medio ambiente',
    terminos: { ambient: 5, ecolog: 4, biodiversidad: 4, agua: 2, forestal: 4, conservacion: 3, car: 2, contaminacion: 3 },
  },
  {
    id: 'desarrollo_economico', nombre: 'Desarrollo económico',
    terminos: { 'desarrollo economico': 5, productividad: 3, competitividad: 4, empleo: 3, mipyme: 4, pyme: 3, encadenamiento: 4, cluster: 4 },
  },
  {
    id: 'emprendimiento', nombre: 'Emprendimiento',
    terminos: { emprendimiento: 5, emprendedor: 4, startup: 4, incubacion: 4, aceleracion: 4, 'modelo de negocio': 3 },
  },
  {
    id: 'investigacion', nombre: 'Investigación',
    terminos: { investigacion: 5, ciencia: 4, cientific: 4, minciencias: 4, laboratorio: 3, 'i+d': 5, publicacion: 2 },
  },
  {
    id: 'cooperacion', nombre: 'Cooperación internacional',
    terminos: { cooperacion: 5, internacional: 3, donante: 4, pnud: 5, usaid: 5, ong: 3, 'banca multilateral': 5, bid: 4 },
  },
  {
    id: 'innovacion', nombre: 'Innovación',
    terminos: { innovacion: 5, innovador: 4, laboratorio: 2, 'innovacion publica': 5, prototipo: 3, disruptiv: 3, 'design thinking': 4 },
  },
  {
    id: 'desarrollo_social', nombre: 'Desarrollo social',
    terminos: { social: 4, vulnerable: 4, inclusion: 4, comunidad: 3, victima: 4, genero: 3, infancia: 3, adulto: 2, poblacion: 2 },
  },
  {
    id: 'agricultura', nombre: 'Agricultura y agroindustria',
    terminos: { agro: 5, agricol: 5, campesin: 4, cultivo: 4, pecuari: 4, rural: 3, ica: 3, cosecha: 4, ganader: 4 },
  },
  {
    id: 'turismo', nombre: 'Turismo',
    terminos: { turismo: 5, turistic: 5, hotel: 3, destino: 3, patrimonio: 2, ecoturismo: 4 },
  },
  {
    id: 'logistica', nombre: 'Logística',
    terminos: { logistic: 5, transporte: 4, distribucion: 3, almacen: 3, cadena: 3, suministro: 3, flota: 3 },
  },
  {
    id: 'energia', nombre: 'Energía',
    terminos: { energia: 5, solar: 4, fotovoltaic: 5, electric: 3, renovable: 5, eficiencia: 2, gas: 3 },
  },
  {
    id: 'cultura', nombre: 'Cultura',
    terminos: { cultura: 5, cultural: 5, arte: 4, artistic: 4, patrimonio: 4, museo: 4, biblioteca: 3, creativ: 3 },
  },
  {
    id: 'software', nombre: 'Software',
    terminos: { software: 5, 'desarrollo de software': 5, saas: 5, aplicativo: 4, 'sistema de informacion': 5, modulo: 3, licenciamiento: 3, codigo: 3, plataforma: 4, erp: 4, crm: 4 },
  },
  {
    id: 'analitica_datos', nombre: 'Analítica de datos',
    terminos: { analitica: 5, 'ciencia de datos': 5, 'big data': 5, 'inteligencia artificial': 4, 'aprendizaje automatico': 4, tablero: 3, dashboard: 4, indicador: 3, estadistic: 3, observatorio: 4, 'datos abiertos': 3, 'toma de decisiones': 2 },
  },
  {
    id: 'politicas_publicas', nombre: 'Políticas públicas',
    terminos: { 'politica publica': 5, 'politicas publicas': 5, normativ: 3, regulacion: 3, 'agenda publica': 4, 'evaluacion de politica': 5, conpes: 5, 'marco normativo': 4 },
  },
  {
    id: 'desarrollo_territorial', nombre: 'Desarrollo territorial',
    terminos: { territorial: 4, territorio: 4, 'desarrollo local': 5, municipio: 3, region: 3, 'cierre de brechas': 4, subregion: 4, provincia: 2 },
  },
  {
    id: 'inteligencia_territorial', nombre: 'Inteligencia territorial',
    terminos: { 'inteligencia territorial': 5, 'sistema de informacion geografic': 5, sig: 4, georreferenciacion: 5, cartografia: 4, 'analisis territorial': 5, catastro: 4, 'datos territoriales': 5 },
  },
  {
    id: 'marketing_territorial', nombre: 'Marketing territorial',
    terminos: { 'marketing territorial': 5, 'marca ciudad': 5, 'marca region': 5, posicionamiento: 3, 'promocion del territorio': 5, atraccion: 3, 'comunicacion publica': 4, reputacion: 3 },
  },
];

// Sector declarado -> categorias que refuerza (senal estructural).
const SECTOR_A_CATEGORIAS = {
  'tecnologia e informacion': ['tecnologia', 'software', 'transformacion_digital', 'govtech', 'analitica_datos'],
  'construccion e infraestructura': ['infraestructura', 'ingenieria'],
  'salud y servicios medicos': ['salud'],
  agroindustria: ['agricultura', 'desarrollo_economico'],
  'consultoria y capacitacion': ['consultoria', 'formacion', 'planeacion', 'politicas_publicas', 'desarrollo_territorial'],
  'suministros y bienes': ['logistica', 'desarrollo_economico'],
};

// Tipo de organizacion -> categorias que refuerza.
const TIPO_A_CATEGORIAS = {
  universidad: ['educacion', 'investigacion', 'formacion'],
  fundacion: ['desarrollo_social', 'cooperacion'],
  organizacion_social: ['desarrollo_social', 'civictech'],
  cooperativa: ['desarrollo_economico', 'desarrollo_social'],
  asociacion: ['desarrollo_economico'],
  consultora: ['consultoria', 'planeacion', 'politicas_publicas'],
  empresa_tecnologica: ['tecnologia', 'software', 'transformacion_digital', 'govtech'],
  corporacion: ['desarrollo_economico'],
};

const MADUREZ_A_CATEGORIAS = {
  avanzada: ['transformacion_digital', 'analitica_datos'],
  producto_digital: ['tecnologia', 'software', 'transformacion_digital', 'govtech'],
};

function normalizar(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Los terminos del lexico son raices ("medic", "agricol", "sostenib"):
// deben coincidir al INICIO de una palabra, nunca en medio, o "ti"
// coincidiria dentro de "administrativo" y "medic" dentro de
// "paramedico". Las siglas y palabras de tres letras o menos ("ti",
// "red", "pot", "car", "ese") exigen ademas coincidencia de palabra
// completa: como prefijo dispararian con "tiempos", "reduce",
// "potencial", "carbono" o "esencial".
function coincide(texto, termino) {
  const escapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cierre = termino.length <= 3 ? '([^a-z0-9]|$)' : '';
  return new RegExp(`(^|[^a-z0-9])${escapado}${cierre}`, 'i').test(texto);
}

// Campos que existen SIEMPRE antes de la etapa 5. La deteccion de
// enfoque (que decide que preguntas se hacen) se calcula solo sobre
// ellos: si dependiera tambien de las respuestas de la etapa 5, el
// conjunto de preguntas visibles podria cambiar a mitad del bloque y
// el indice de paso dejaria de ser estable.
const CAMPOS_BASE = [
  'sector_texto', 'tipo_bien_servicio', 'problema_que_resuelve',
  'diferenciador', 'reto_actual', 'objetivo_6_meses', 'entidades_objetivo', 'nombre',
];

// Respuestas de la etapa 7 (profundizacion adaptativa). Enriquecen la
// clasificacion FINAL (la que alimenta el diagnostico), nunca la
// deteccion de enfoque: si la alimentaran, el enfoque podria cambiar
// mientras la organizacion responde el bloque que ese mismo enfoque
// abrio.
const CAMPOS_PROFUNDIZACION = [
  'problema_detallado', 'tec_dependencia_objetivo', 'for_resultados',
  'con_resultados', 'fun_territorios', 'uni_lineas_investigacion',
];

function textoDelPerfil(respuestas = {}, { incluirProfundizacion = true } = {}) {
  const campos = incluirProfundizacion
    ? [...CAMPOS_BASE, ...CAMPOS_PROFUNDIZACION]
    : CAMPOS_BASE;
  return normalizar(
    campos
      .map((campo) => respuestas[campo])
      .filter(Boolean)
      .join(' . ')
  );
}

/**
 * Clasifica la organizacion en las categorias tematicas del ecosistema
 * IDEAPRO, con porcentaje de afinidad y evidencia.
 * @param {object} respuestas respuestas planas de la sesion
 * @returns {{categorias: Array, principal: object|null, texto: string}}
 */
export function clasificarOrganizacion(respuestas = {}, opciones = {}) {
  const texto = textoDelPerfil(respuestas, opciones);
  const sector = normalizar(respuestas.sector_texto);
  const refuerzoSector = SECTOR_A_CATEGORIAS[sector] || [];
  const refuerzoTipo = TIPO_A_CATEGORIAS[respuestas.tipo_organizacion] || [];
  const refuerzoMadurez = MADUREZ_A_CATEGORIAS[respuestas.madurez_tecnologica] || [];

  const evaluadas = CATEGORIAS.map((categoria) => {
    let evidencia = 0;
    const coincidencias = [];

    for (const [termino, peso] of Object.entries(categoria.terminos)) {
      if (coincide(texto, termino)) {
        evidencia += peso;
        coincidencias.push(termino);
      }
    }

    // La evidencia lexica satura en 12 puntos brutos = 70% de afinidad.
    const puntosLexicos = Math.min(70, Math.round((Math.min(evidencia, 12) / 12) * 70));

    let puntosEstructurales = 0;
    const senales = [];
    if (refuerzoSector.includes(categoria.id)) { puntosEstructurales += 15; senales.push('sector declarado'); }
    if (refuerzoTipo.includes(categoria.id)) { puntosEstructurales += 10; senales.push('naturaleza jurídica'); }
    if (refuerzoMadurez.includes(categoria.id)) { puntosEstructurales += 5; senales.push('madurez tecnológica'); }

    const afinidad = Math.min(100, puntosLexicos + Math.min(30, puntosEstructurales));

    return {
      id: categoria.id,
      nombre: categoria.nombre,
      afinidad,
      evidencia: coincidencias.slice(0, 6),
      senales,
    };
  })
    .filter((categoria) => categoria.afinidad >= 25)
    .sort((a, b) => b.afinidad - a.afinidad);

  const categorias = evaluadas.slice(0, 8);

  return {
    categorias,
    principal: categorias[0] || null,
    // La rúbrica maestra (etapa 7) exige categoría principal Y
    // subcategoría: la subcategoría es la segunda afinidad más alta,
    // que es la que explica el matiz de la organización (p. ej.
    // "Tecnología / GovTech" frente a "Tecnología / Salud").
    subcategoria: categorias[1] || null,
    // Se conserva el texto analizado para trazabilidad del diagnóstico.
    texto,
  };
}

// =====================================================================
// ETAPA 5 · Detector de enfoque para la selección inteligente de
// preguntas
// ---------------------------------------------------------------------
// El protocolo pide que el consultor NO haga las mismas preguntas a
// todos: una empresa de software y una fundación deben recibir
// preguntas distintas. Este detector traduce la clasificación (etapa 3)
// y la naturaleza jurídica (etapa 1) a los cinco bloques de
// profundización que define el protocolo.
//
// Reglas de diseño:
//   1. Solo mira campos que ya existen antes de la etapa 5, para que el
//      conjunto de preguntas visibles no cambie mientras se responde.
//   2. Máximo dos enfoques: una conversación consultiva profundiza, no
//      interroga. Si la organización califica para más, se conservan
//      los dos de mayor evidencia.
// =====================================================================

const ENFOQUES = [
  {
    id: 'tecnologia',
    categorias: { tecnologia: 40, software: 40, govtech: 40, civictech: 45, transformacion_digital: 45, analitica_datos: 45 },
    tipos: ['empresa_tecnologica'],
    madurez: ['producto_digital'],
  },
  {
    id: 'formacion',
    categorias: { formacion: 40, educacion: 50 },
    tipos: [],
  },
  {
    id: 'consultoria',
    categorias: { consultoria: 40, planeacion: 45, politicas_publicas: 45, desarrollo_territorial: 50, inteligencia_territorial: 45 },
    tipos: ['consultora'],
  },
  {
    id: 'fundacion',
    categorias: { desarrollo_social: 50, cooperacion: 50 },
    tipos: ['fundacion', 'organizacion_social'],
  },
  {
    id: 'universidad',
    categorias: { investigacion: 50 },
    tipos: ['universidad'],
  },
];

// Caché de una sola entrada: getVisibleQuestions() evalúa el showIf de
// cada pregunta en cada petición, y sin esto se reclasificaría la
// organización decenas de veces por request.
let cacheEnfoques = { firma: null, valor: [] };

/**
 * Devuelve los bloques de profundización aplicables (etapa 5).
 * @param {object} respuestas respuestas planas de la sesión
 * @returns {string[]} ids de enfoque, máximo dos, en el orden del protocolo
 */
export function detectarEnfoques(respuestas = {}) {
  const firma = JSON.stringify([
    ...CAMPOS_BASE.map((campo) => respuestas[campo] ?? null),
    respuestas.tipo_organizacion ?? null,
    respuestas.madurez_tecnologica ?? null,
  ]);
  if (cacheEnfoques.firma === firma) return cacheEnfoques.valor;

  // Sin oferta declarada todavía no hay nada que profundizar: el bloque
  // se activa cuando la etapa 4 ya aportó el qué y el para qué.
  if (!respuestas.tipo_bien_servicio) {
    cacheEnfoques = { firma, valor: [] };
    return cacheEnfoques.valor;
  }

  const { categorias } = clasificarOrganizacion(respuestas, { incluirProfundizacion: false });
  const afinidadPorId = Object.fromEntries(categorias.map((c) => [c.id, c.afinidad]));

  const puntuados = ENFOQUES.map((enfoque) => {
    let evidencia = 0;
    for (const [categoriaId, umbral] of Object.entries(enfoque.categorias)) {
      const afinidad = afinidadPorId[categoriaId] || 0;
      if (afinidad >= umbral) evidencia = Math.max(evidencia, afinidad);
    }
    // La naturaleza jurídica declarada es una señal dura: una fundación
    // recibe las preguntas de fundación aunque su texto sea genérico.
    if (enfoque.tipos?.includes(respuestas.tipo_organizacion)) evidencia = Math.max(evidencia, 100);
    if (enfoque.madurez?.includes(respuestas.madurez_tecnologica)) evidencia = Math.max(evidencia, 90);
    return { id: enfoque.id, evidencia };
  })
    .filter((enfoque) => enfoque.evidencia > 0)
    .sort((a, b) => b.evidencia - a.evidencia)
    // El segundo bloque solo se abre con evidencia fuerte: si no, una
    // fundación cuyo sector declarado es "consultoría y capacitación"
    // terminaría respondiendo también el cuestionario de consultoría.
    .filter((enfoque, indice) => indice === 0 || enfoque.evidencia >= 60)
    .slice(0, 2)
    .map((enfoque) => enfoque.id);

  // Se devuelven ORDENADOS POR EVIDENCIA: el primero es el enfoque
  // dominante y recibe todo su bloque de preguntas; el segundo solo
  // recibe sus preguntas clave (ver questions.js). El orden en que se
  // formulan en la conversación lo define el arreglo QUESTIONS, no este.
  cacheEnfoques = { firma, valor: puntuados };
  return puntuados;
}

export const _internal = { CATEGORIAS, ENFOQUES, normalizar, textoDelPerfil };
