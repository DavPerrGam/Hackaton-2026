// =====================================================================
// ETAPA 4 · Generacion de tags estandarizados
// ---------------------------------------------------------------------
// El protocolo pide etiquetas normalizadas ("Software", "Alcaldias",
// "Gestion Documental", "Gobierno Digital", "GovTech") con un proposito
// muy concreto: AGRUPAR organizaciones parecidas. Son la llave con la
// que la etapa 11 (relaciones empresariales) encuentra aliados y la
// que permite al panel administrativo consultar el ecosistema por
// tema, no por razon social.
//
// Por eso los tags NO son texto libre ni salen de un LLM: se derivan de
// forma determinista de cuatro fuentes ya calculadas, y cada tag
// declara de donde salio para poder explicarlo:
//   1. la clasificacion sectorial (etapa 3),
//   2. un lexico controlado de capacidades y temas de politica publica,
//   3. el mapa de entidades objetivo (etapa 10),
//   4. senales estructurales de la ficha (tipo de organizacion,
//      cobertura, experiencia publica).
//
// Un tag inventado rompe la agrupacion: dos organizaciones identicas
// quedarian en grupos distintos por una diferencia de redaccion. De ahi
// que el vocabulario sea cerrado.
// =====================================================================

// Lexico controlado: raiz detectada en el texto -> tag normalizado.
// Las raices siguen la misma convencion que classification.js (se
// comparan sobre texto normalizado, sin tildes y en minuscula).
const LEXICO_TAGS = {
  'gestion documental': 'Gestión documental',
  archivo: 'Gestión documental',
  interoperabilidad: 'Interoperabilidad',
  'datos abiertos': 'Datos abiertos',
  tramite: 'Trámites',
  'ventanilla unica': 'Ventanilla única',
  'gobierno digital': 'Gobierno digital',
  'atencion al ciudadano': 'Atención al ciudadano',
  ciberseguridad: 'Ciberseguridad',
  'inteligencia artificial': 'Inteligencia artificial',
  analitica: 'Analítica de datos',
  'big data': 'Analítica de datos',
  tablero: 'Tableros de control',
  indicador: 'Medición de indicadores',
  observatorio: 'Observatorios',
  georreferenciacion: 'Información geográfica',
  cartografia: 'Información geográfica',
  catastro: 'Catastro',
  'plan de desarrollo': 'Planes de desarrollo',
  ordenamiento: 'Ordenamiento territorial',
  pot: 'Ordenamiento territorial',
  'politica publica': 'Políticas públicas',
  mga: 'Formulación MGA',
  regalias: 'Sistema General de Regalías',
  secop: 'SECOP II',
  'banco de proyectos': 'Bancos de proyectos',
  interventoria: 'Interventoría',
  obra: 'Obra pública',
  acueducto: 'Agua y saneamiento',
  alcantarillado: 'Agua y saneamiento',
  residuo: 'Residuos sólidos',
  renovable: 'Energías renovables',
  fotovoltaic: 'Energía solar',
  'eficiencia energetica': 'Eficiencia energética',
  diplomado: 'Diplomados',
  curso: 'Cursos',
  virtual: 'Formación virtual',
  competencia: 'Desarrollo de competencias',
  'transferencia tecnologica': 'Transferencia tecnológica',
  investigacion: 'Investigación aplicada',
  'primera infancia': 'Primera infancia',
  victima: 'Víctimas del conflicto',
  genero: 'Enfoque de género',
  discapacidad: 'Discapacidad',
  campesin: 'Desarrollo rural',
  rural: 'Desarrollo rural',
  emprendimiento: 'Emprendimiento',
  turismo: 'Turismo',
  patrimonio: 'Patrimonio',
  'salud mental': 'Salud mental',
  telemedicina: 'Telemedicina',
  biodiversidad: 'Biodiversidad',
  'cambio climatico': 'Cambio climático',
  cooperacion: 'Cooperación internacional',
  participacion: 'Participación ciudadana',
  transparencia: 'Transparencia',
};

const TIPO_ORGANIZACION_TAG = {
  empresa_privada: 'Empresa privada',
  fundacion: 'Fundación',
  universidad: 'Universidad',
  cooperativa: 'Cooperativa',
  asociacion: 'Asociación',
  consultora: 'Consultora',
  empresa_tecnologica: 'Empresa tecnológica',
  organizacion_social: 'Organización social',
  corporacion: 'Corporación',
};

const COBERTURA_TAG = {
  local: 'Cobertura municipal',
  departamental: 'Cobertura departamental',
  regional: 'Cobertura regional',
  nacional: 'Cobertura nacional',
};

// Campos de la conversacion que aportan vocabulario. Incluye las
// profundizaciones (etapa 7) porque son las mas descriptivas de todas:
// se hicieron precisamente donde faltaba evidencia.
const CAMPOS_TEXTO = [
  'tipo_bien_servicio', 'problema_que_resuelve', 'diferenciador',
  'reto_actual', 'objetivo_6_meses', 'entidades_objetivo', 'sector_texto',
  'problema_detallado', 'tec_dependencia_objetivo', 'for_resultados',
  'con_resultados', 'fun_territorios', 'uni_lineas_investigacion',
];

const LIMITE_TAGS = 16;

function normalizar(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Misma regla de coincidencia que la clasificacion: raiz al inicio de
// palabra, y palabra completa para siglas de tres letras o menos, para
// que "pot" no dispare con "potencial" ni "mga" dentro de otra palabra.
function coincide(texto, termino) {
  const escapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cierre = termino.length <= 3 ? '([^a-z0-9]|$)' : '';
  return new RegExp(`(^|[^a-z0-9])${escapado}${cierre}`, 'i').test(texto);
}

/**
 * Genera los tags estandarizados de la organización (etapa 4).
 *
 * @param {object} params
 * @param {object} params.respuestas respuestas planas de la sesión
 * @param {object} params.clasificacion salida de clasificarOrganizacion()
 * @param {object} params.perfilamiento salida de perfilarOferta()
 * @param {object} params.mapaEntidades salida de construirMapaEntidades()
 * @param {object} params.diagnostico salida de calcularDiagnostico()
 * @returns {{tags: Array<{tag: string, tipo: string, origen: string}>, lista: string[]}}
 */
export function generarTags({
  respuestas = {},
  clasificacion = {},
  perfilamiento = {},
  mapaEntidades = null,
  diagnostico = null,
} = {}) {
  const encontrados = new Map(); // clave normalizada -> tag

  const agregar = (tag, tipo, origen) => {
    if (!tag) return;
    const clave = normalizar(tag);
    if (!clave || encontrados.has(clave)) return;
    encontrados.set(clave, { tag, tipo, origen });
  };

  // 1. Categorías con afinidad relevante. Son el eje de la agrupación.
  for (const categoria of clasificacion?.categorias || []) {
    if (categoria.afinidad >= 40) {
      agregar(categoria.nombre, 'categoria', `clasificación sectorial (${categoria.afinidad}% de afinidad)`);
    }
  }

  // 2. Vocabulario controlado sobre lo que la organización contó.
  const texto = normalizar(CAMPOS_TEXTO.map((campo) => respuestas[campo]).filter(Boolean).join(' . '));
  for (const [termino, tag] of Object.entries(LEXICO_TAGS)) {
    if (coincide(texto, termino)) agregar(tag, 'capacidad', `mencionado como "${termino}"`);
  }

  // 3. Entidades a las que puede llegar hoy: agrupa por mercado, que es
  //    lo que hace útil el tag para buscar aliados y no solo pares.
  for (const entidad of (mapaEntidades?.entidades || []).filter((e) => e.accesible_hoy).slice(0, 4)) {
    agregar(entidad.nombre, 'entidad', 'entidad objetivo accesible hoy');
  }

  // 4. Necesidad pública principal de la cadena de valor (etapa 6).
  const necesidad = perfilamiento?.cadenas?.[0]?.necesidad_publica;
  if (necesidad) {
    // Se corta en la primera conjunción: "Modernización institucional y
    // gobierno digital" agrupa mejor como "Modernización institucional".
    const corta = String(necesidad).split(/\s+y\s+/)[0].trim();
    agregar(corta.charAt(0).toUpperCase() + corta.slice(1), 'necesidad', 'necesidad pública que atiende');
  }

  // 5. Señales estructurales de la ficha.
  agregar(TIPO_ORGANIZACION_TAG[respuestas.tipo_organizacion], 'organizacion', 'naturaleza jurídica declarada');
  agregar(COBERTURA_TAG[respuestas.cobertura_territorial], 'organizacion', 'cobertura declarada');
  if (respuestas.experiencia_previa_contratos === true) {
    agregar('Experiencia pública acreditada', 'estado', 'contratos o convenios públicos ejecutados');
  }
  if (respuestas.tiene_rup === true) agregar('RUP vigente', 'estado', 'RUP inscrito y actualizado');
  if (diagnostico?.nivelMadurez?.nombre) {
    agregar(`Nivel ${diagnostico.nivelMadurez.nivel} · ${diagnostico.nivelMadurez.nombre}`, 'estado', 'nivel de madurez calculado');
  }

  const tags = [...encontrados.values()].slice(0, LIMITE_TAGS);
  return { tags, lista: tags.map((t) => t.tag) };
}

export const _internal = { LEXICO_TAGS, normalizar, coincide };
