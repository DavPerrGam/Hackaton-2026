// =====================================================================
// ETAPA 15 · Reporte final
// ---------------------------------------------------------------------
// Ensambla las 20 secciones que exige el protocolo Nexus a partir de
// lo que ya calcularon los motores deterministas. Este modulo NO
// calcula nada nuevo: solo organiza y redacta, de modo que cualquier
// cifra del reporte sea trazable hasta la respuesta que la origino.
//
// La salida es un arreglo ordenado de secciones
// { numero, id, titulo, tipo, contenido } que el frontend renderiza y
// que se persiste integro en diagnosticos.reporte_final.
// =====================================================================

const NIVEL_ETIQUETA = {
  exploracion: 'Nivel 1 · Exploración',
  preparacion: 'Nivel 2 · Preparación',
  lista_para_explorar: 'Nivel 3 · Lista para explorar',
  preparada: 'Nivel 4 · Preparada',
  consolidada: 'Nivel 5 · Consolidada',
};

const ESTADO_ELEGIBILIDAD_ETIQUETA = {
  elegible: 'ELEGIBLE',
  riesgo: 'RIESGO DE ELEGIBILIDAD',
  no_elegible: 'NO ELEGIBLE',
};

export function construirReporteFinal({
  empresa = {},
  respuestas = {},
  diagnostico,
  clasificacion,
  perfilamiento,
  mapaEntidades,
  ruta = [],
  planAccion,
  encaje = [],
  resumenIA = '',
  tags = null,
  relaciones = null,
}) {
  const nombre = empresa.nombre || respuestas.nombre || 'La organización';
  const nivel = diagnostico.nivelMadurez;
  const secciones = [];
  const agregar = (id, titulo, tipo, contenido) => {
    secciones.push({ numero: secciones.length + 1, id, titulo, tipo, contenido });
  };

  // 1 ----------------------------------------------------------------
  agregar('resumen_ejecutivo', 'Resumen ejecutivo', 'texto', {
    texto: resumenIA || resumenDeterministico({ nombre, diagnostico, ruta }),
    indice: diagnostico.indiceIdeapro,
    nivel: NIVEL_ETIQUETA[diagnostico.nivelMadurezGlobal] || diagnostico.nivelMadurezGlobal,
  });

  // 2 ----------------------------------------------------------------
  agregar('elegibilidad', 'Estado de elegibilidad', 'elegibilidad', {
    estado: diagnostico.elegibilidad.estado,
    etiqueta: ESTADO_ELEGIBILIDAD_ETIQUETA[diagnostico.elegibilidad.estado],
    mensaje: diagnostico.elegibilidad.mensaje,
    criterios: diagnostico.elegibilidad.criterios,
    cumplidos: `${diagnostico.elegibilidad.cumplidos} de ${diagnostico.elegibilidad.total}`,
  });

  // 3 ----------------------------------------------------------------
  // El agente no pregunta lo que puede deducir, pero cada dato deducido
  // se marca como tal: la organización tiene que poder ver de dónde
  // salió y corregirlo. Un dato inferido que nadie puede auditar es,
  // para efectos prácticos, un dato inventado.
  const deducidos = respuestas._inferidos || {};
  const ficha = (campo, etiqueta, valor) => {
    const deduccion = deducidos[campo];
    return {
      campo,
      etiqueta,
      valor,
      origen: deduccion ? `Deducido de ${deduccion.origen}` : 'Declarado',
      deducido: Boolean(deduccion),
    };
  };

  agregar('perfil_organizacional', 'Perfil organizacional', 'fichas', {
    campos: [
      ficha('nombre', 'Organización', nombre),
      ficha('tipo_organizacion', 'Tipo de organización', etiquetaTipo(respuestas.tipo_organizacion)),
      ficha('nombre_contacto', 'Representante', respuestas.nombre_contacto || empresa.nombre_contacto || 'No declarado'),
      ficha('cargo_contacto', 'Cargo', respuestas.cargo_contacto || 'No declarado'),
      ficha('correo_contacto', 'Correo', respuestas.correo_contacto || empresa.correo_contacto || 'No declarado'),
      ficha('ubicacion_ciudad', 'Ciudad', respuestas.ubicacion_ciudad || 'No declarada'),
      ficha('ubicacion_departamento', 'Departamento', respuestas.ubicacion_departamento || 'No declarado'),
      ficha('sitio_web', 'Sitio web', respuestas.sitio_web || 'No declarado'),
      ficha('sector_texto', 'Sector económico', respuestas.sector_texto || 'No declarado'),
      ficha('anios_operacion', 'Años de operación', String(respuestas.anios_operacion ?? 'No declarado')),
      ficha('tamanio_equipo', 'Tamaño del equipo', String(respuestas.tamanio_equipo ?? 'No declarado')),
      ficha('cobertura_territorial', 'Cobertura', etiquetaCobertura(respuestas.cobertura_territorial)),
    ],
    // Trazabilidad de la conversación: cuántas preguntas se hicieron de
    // verdad, qué se dedujo sin preguntar y qué señal abrió cada
    // pregunta adicional.
    conversacion: {
      deducidos: Object.entries(deducidos).map(([campo, dato]) => ({
        campo, valor: dato.valor, origen: dato.origen, evidencia: dato.evidencia,
      })),
      profundizaciones: (respuestas._profundizacion?.senales || []).map((senal) => ({
        tipo: senal.tipo, razon: senal.razon, pregunta: senal.pregunta,
      })),
    },
  });

  // 4 ----------------------------------------------------------------
  agregar('clasificacion', 'Clasificación sectorial', 'afinidades', {
    categorias: clasificacion?.categorias || [],
    principal: clasificacion?.principal?.nombre || null,
    subcategoria: clasificacion?.subcategoria?.nombre || null,
    // Etapa 4 del protocolo: los tags son la llave de agrupación del
    // ecosistema, por eso viajan junto a la clasificación y no en una
    // sección aparte.
    tags: tags?.tags || [],
    nota: 'Una organización puede pertenecer a varias categorías; el porcentaje indica la afinidad detectada a partir de toda la conversación.',
  });

  // 5 ----------------------------------------------------------------
  agregar('perfilamiento_oferta', 'Perfilamiento de servicios', 'cadenas_valor', {
    cadenas: perfilamiento?.cadenas || [],
    resumen: perfilamiento?.resumen || '',
    alerta: perfilamiento?.alerta || null,
    diferenciador: perfilamiento?.diferenciador || null,
    // Etapa 5: lo que la organización respondió en el bloque de
    // profundización propio de su enfoque. Es la evidencia cualitativa
    // que sostiene la cadena de valor.
    profundizacion: profundizacionPorEnfoque(respuestas),
  });

  // 6 a 10 ------------------------------------------------------------
  const dim = diagnostico.dimensionesIdeapro;
  agregar('evaluacion_tecnica', 'Evaluación técnica', 'evaluacion', evaluacion(
    dim.tecnica,
    [
      hallazgo(respuestas.procesos_documentados === true, 'Metodología y procesos documentados'),
      hallazgo(Number(respuestas.casos_exito) >= 2, `Casos de éxito documentados: ${Number(respuestas.casos_exito) || 0}`),
      hallazgo(respuestas.capacidad_escalar === true, 'Capacidad de ejecución simultánea'),
      hallazgo(respuestas.capacidad_operativa === true, 'Capacidad operativa disponible'),
      hallazgo(['avanzada', 'producto_digital'].includes(respuestas.madurez_tecnologica), `Madurez tecnológica: ${etiquetaMadurezTec(respuestas.madurez_tecnologica)}`),
    ]
  ));

  agregar('evaluacion_juridica', 'Evaluación jurídica y documental', 'evaluacion', evaluacion(
    dim.juridica_documental,
    [
      hallazgo(respuestas.camara_comercio === true, 'Registro mercantil renovado'),
      hallazgo(respuestas.tiene_rup === true, 'RUP inscrito y actualizado'),
      hallazgo(respuestas.gestion_documental === true, 'Expediente documental organizado'),
      hallazgo(respuestas.conoce_pliegos === true, 'Lectura e interpretación de pliegos'),
      hallazgo(respuestas.certificaciones === true, 'Certificaciones o habilitaciones vigentes'),
    ]
  ));

  agregar('evaluacion_financiera', 'Evaluación financiera', 'evaluacion_financiera', {
    ...evaluacion(dim.financiera, [
      hallazgo(respuestas.ventas_registradas === true, 'Ingresos registrados contablemente'),
      hallazgo(respuestas.capital_trabajo === true, 'Capital de trabajo disponible'),
      hallazgo(respuestas.flujo_caja === true, 'Flujo de caja para 2-3 meses sin pagos'),
      hallazgo(respuestas.capacidad_garantias === true, 'Experiencia gestionando pólizas y garantías'),
      hallazgo(respuestas.endeudamiento === 'bajo', `Nivel de endeudamiento: ${etiquetaEndeudamiento(respuestas.endeudamiento)}`),
    ]),
    riesgo: diagnostico.riesgoFinanciero,
  });

  agregar('evaluacion_comercial', 'Evaluación comercial pública', 'evaluacion', evaluacion(
    dim.comercial_publica,
    [
      hallazgo(respuestas.equipo_comercial_dedicado === true, 'Responsable dedicado a oportunidades públicas'),
      hallazgo(Boolean(perfilamiento?.diferenciador), 'Diferenciador competitivo explícito'),
      hallazgo(Boolean(respuestas.entidades_objetivo) && respuestas.entidades_objetivo !== 'no', 'Entidades objetivo identificadas'),
      hallazgo(Boolean(respuestas.sitio_web) && respuestas.sitio_web !== 'no', 'Presencia institucional en línea'),
    ]
  ));

  agregar('evaluacion_ecosistema', 'Evaluación del ecosistema público', 'evaluacion', evaluacion(
    dim.ecosistema_publico,
    [
      hallazgo(respuestas.conoce_secop === true, 'Monitoreo de SECOP II / Colombia Compra Eficiente'),
      hallazgo(respuestas.conoce_planes_desarrollo === true, 'Lectura de planes de desarrollo territoriales'),
      hallazgo(respuestas.conoce_mga === true, 'Conocimiento de MGA, bancos de proyectos y SGR'),
      hallazgo(respuestas.experiencia_previa_contratos === true, 'Relacionamiento contractual público previo'),
    ]
  ));

  // 11 ---------------------------------------------------------------
  agregar('nivel_madurez', 'Nivel de madurez', 'madurez', {
    nivel: nivel.nivel,
    nombre: nivel.nombre,
    descripcion: nivel.descripcion,
    indice: diagnostico.indiceIdeapro,
    nivel_base: nivel.nivelBase,
    penalizaciones: nivel.penalizaciones,
    ruta_niveles: construirRutaCrecimiento(nivel.nivel),
    nota: nivel.penalizaciones.length > 0
      ? 'El nivel no es un promedio: el índice sugería un nivel superior, pero las brechas y riesgos identificados actúan como techo.'
      : 'El nivel es consistente con el índice: no se identificaron brechas habilitantes que lo limiten.',
  });

  // 12 ---------------------------------------------------------------
  agregar('fortalezas', 'Fortalezas', 'lista', {
    items: diagnostico.fortalezas.length > 0
      ? diagnostico.fortalezas.map((f) => `${f.nombre}: ${f.score}/100 (${f.etiqueta}).`)
      : ['Aún no se consolidan fortalezas diferenciales: todos los ejes están por debajo de 60/100.'],
  });

  // 13 ---------------------------------------------------------------
  agregar('brechas_criticas', 'Brechas críticas', 'brechas', {
    familias: diagnostico.brechasPorFamilia,
    por_eje: diagnostico.brechas,
  });

  // 14 ---------------------------------------------------------------
  agregar('riesgos', 'Riesgos', 'lista', {
    items: [
      ...diagnostico.elegibilidad.riesgos.map((r) => `Elegibilidad · ${r.nombre}: ${r.razon}`),
      ...diagnostico.riesgoFinanciero.alertas.map((a) => `Financiero · ${a}`),
      ...diagnostico.brechasPorFamilia
        .filter((b) => b.urgencia === 'inmediata')
        .map((b) => `${b.nombre} · ${b.riesgo}`),
    ],
  });

  // 15 ---------------------------------------------------------------
  agregar('entidades_objetivo', 'Entidades objetivo', 'entidades', {
    entidades: mapaEntidades?.entidades || [],
    entrada_recomendada: mapaEntidades?.entrada_recomendada || null,
    territorio: mapaEntidades?.territorio || {},
  });

  // 16 ---------------------------------------------------------------
  agregar('organizaciones_similares', 'Organizaciones similares y posibles alianzas', 'similares', {
    organizaciones: relaciones?.organizaciones || [],
    evaluadas: relaciones?.evaluadas ?? 0,
    nota: relaciones?.nota
      || (relaciones ? null : 'La comparación con el ecosistema no estaba disponible al generar este reporte.'),
  });

  // 17 ---------------------------------------------------------------
  agregar('oportunidades', 'Oportunidades detectadas', 'oportunidades', {
    items: (encaje || []).slice(0, 6).map((item) => ({
      nombre: item.oportunidad?.nombre || item.oportunidad?.nombre_tipo || 'Oportunidad',
      porcentaje: item.porcentajeEncaje ?? item.porcentaje_encaje ?? 0,
      brechas: item.brechas || item.brechas_identificadas || [],
    })),
    nota: (encaje || []).length === 0
      ? 'No se identificaron oportunidades con encaje suficiente en el catálogo activo. La ruta de servicios busca precisamente habilitar ese encaje.'
      : null,
  });

  // 18 ---------------------------------------------------------------
  agregar('servicios_ideapro', 'Recomendaciones IDEAPRO', 'servicios', {
    items: ruta.map((item) => ({
      orden: item.orden_prioridad,
      nombre: item.servicio?.nombre_servicio || item.nombre,
      tipo: item.tipo,
      justificacion: item.justificacion,
    })),
    nota: ruta.length === 0
      ? 'La organización supera los umbrales del catálogo estándar: corresponde un acompañamiento estratégico a la medida.'
      : null,
  });

  // 19 ---------------------------------------------------------------
  agregar('plan_accion', 'Plan de acción 30/60/90/180', 'plan', planAccion || { horizontes: [] });

  // 20 ---------------------------------------------------------------
  agregar('conclusion', 'Conclusión estratégica', 'texto', {
    texto: construirConclusion({ nombre, diagnostico, mapaEntidades, planAccion, relaciones }),
  });

  return {
    generado_en: new Date().toISOString(),
    organizacion: nombre,
    indice: diagnostico.indiceIdeapro,
    nivel: nivel.nivel,
    estado_elegibilidad: diagnostico.elegibilidad.estado,
    tags: tags?.lista || [],
    secciones,
  };
}

// ------------------------------------------------------------ helpers

// Profundizaciones (etapa 7 de la conversación): las preguntas extra
// que el agente hizo SOLO a esta organización, porque sufficiency.js
// detectó una inconsistencia, una brecha, un riesgo o una oportunidad.
// Se reportan con su formulación original para que el reporte se lea
// como la conversación que efectivamente ocurrió.
const PREGUNTAS_ENFOQUE = [
  ['figura_contratacion', 'Figura bajo la que contrató con el Estado'],
  ['problema_detallado', 'Caso concreto del problema que resuelve'],
  ['tec_dependencia_objetivo', 'Dependencia pública que más se beneficiaría'],
  ['for_resultados', 'Resultados verificables de la formación'],
  ['con_resultados', 'Resultado dejado en la última entidad acompañada'],
  ['fun_territorios', 'Territorios donde opera'],
  ['uni_lineas_investigacion', 'Líneas de investigación o extensión'],
  ['financiacion_ejecucion', 'Con qué financiaría la ejecución antes del primer desembolso'],
  ['entidades_objetivo', 'Entidades públicas objetivo'],
];

function profundizacionPorEnfoque(respuestas = {}) {
  return PREGUNTAS_ENFOQUE
    .filter(([id]) => respuestas[id] !== undefined && respuestas[id] !== '')
    .map(([id, etiqueta]) => ({
      id,
      etiqueta,
      valor: typeof respuestas[id] === 'boolean'
        ? (respuestas[id] ? 'Sí' : 'No')
        : String(respuestas[id]),
    }));
}

function hallazgo(cumple, texto) {
  return { cumple: Boolean(cumple), texto };
}

function evaluacion(score, hallazgos) {
  const banda = score <= 20 ? 'Muy débil'
    : score <= 40 ? 'Inicial'
      : score <= 60 ? 'En desarrollo'
        : score <= 80 ? 'Sólida' : 'Avanzada';
  return {
    score,
    interpretacion: banda,
    hallazgos,
    cumplidos: hallazgos.filter((h) => h.cumple).length,
    total: hallazgos.length,
  };
}

function etiquetaTipo(valor) {
  const mapa = {
    empresa_privada: 'Empresa privada',
    fundacion: 'Fundación',
    universidad: 'Universidad o institución educativa',
    cooperativa: 'Cooperativa',
    asociacion: 'Asociación / gremio',
    consultora: 'Consultora',
    empresa_tecnologica: 'Empresa tecnológica',
    organizacion_social: 'Organización social / ONG',
    corporacion: 'Corporación',
    otra: 'Otra',
  };
  return mapa[valor] || 'No declarado';
}

function etiquetaCobertura(valor) {
  const mapa = {
    local: 'Municipal',
    departamental: 'Departamental',
    regional: 'Regional (varios departamentos)',
    nacional: 'Nacional',
  };
  return mapa[valor] || 'No declarada';
}

function etiquetaMadurezTec(valor) {
  const mapa = {
    basica: 'Básica',
    intermedia: 'Intermedia',
    avanzada: 'Avanzada',
    producto_digital: 'Producto digital propio',
  };
  return mapa[valor] || 'No declarada';
}

function etiquetaEndeudamiento(valor) {
  const mapa = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', no_sabe: 'No monitoreado' };
  return mapa[valor] || 'No declarado';
}

function resumenDeterministico({ nombre, diagnostico, ruta }) {
  const primero = ruta?.[0]?.servicio?.nombre_servicio;
  return `${nombre} obtuvo un índice IDEAPRO de ${diagnostico.indiceIdeapro}/1000 y se ubica en ${NIVEL_ETIQUETA[diagnostico.nivelMadurezGlobal]}. `
    + `${diagnostico.elegibilidad.mensaje} `
    + `El frente que más limita su avance es "${diagnostico.brechas[0]?.nombre || 'sin brechas relevantes'}". `
    + (primero ? `El primer paso recomendado es "${primero}".` : 'Corresponde un acompañamiento estratégico a la medida.');
}

function construirRutaCrecimiento(nivelActual) {
  const etapas = [
    { nivel: 1, nombre: 'Exploración', meta: 'Constituir las bases: registros vigentes, expediente documental y propuesta de valor formulada.' },
    { nivel: 2, nombre: 'Preparación', meta: 'Cerrar los habilitantes duros (RUP, garantías, capital de trabajo) y documentar la experiencia.' },
    { nivel: 3, nombre: 'Lista para explorar', meta: 'Entrar al ecosistema: monitorear SECOP II, priorizar entidades y presentar las primeras ofertas de cuantía baja.' },
    { nivel: 4, nombre: 'Preparada', meta: 'Competir de forma sostenida, con capacidad de ejecución simultánea y experiencia pública acreditada.' },
    { nivel: 5, nombre: 'Consolidada', meta: 'Participar en la estructuración de la necesidad pública, no solo en la respuesta al pliego.' },
  ];
  return etapas.map((etapa) => ({
    ...etapa,
    estado: etapa.nivel < nivelActual ? 'superada' : etapa.nivel === nivelActual ? 'actual' : 'siguiente',
  }));
}

function construirConclusion({ nombre, diagnostico, mapaEntidades, planAccion, relaciones = null }) {
  const criticas = planAccion?.acciones_criticas || 0;
  const entrada = mapaEntidades?.entrada_recomendada?.ejemplo_territorial
    || mapaEntidades?.entrada_recomendada?.nombre;
  const brecha = diagnostico.brechasPorFamilia.find((b) => b.estado === 'con_brecha');
  const aliado = (relaciones?.organizaciones || [])
    .find((organizacion) => organizacion.tipo_relacion === 'complementaria')
    || null;

  return `${nombre} se encuentra en ${NIVEL_ETIQUETA[diagnostico.nivelMadurezGlobal]} frente al mercado público colombiano, `
    + `con un índice IDEAPRO de ${diagnostico.indiceIdeapro}/1000 y un riesgo financiero ${diagnostico.riesgoFinanciero.nivel}. `
    + (brecha
      ? `La prioridad inmediata está en las ${brecha.nombre.toLowerCase()}: ${brecha.recomendacion} `
      : 'No se identificaron brechas habilitantes que impidan avanzar de inmediato. ')
    + (criticas > 0
      ? `El plan de acción concentra ${criticas} acción(es) crítica(s) en los primeros 30 días, que son condición para presentarse a cualquier proceso. `
      : 'El plan de acción se concentra en posicionamiento y escalamiento, no en habilitantes. ')
    + (entrada ? `La puerta de entrada recomendada es ${entrada}. ` : '')
    + (aliado
      ? `Dentro del ecosistema IDEAPRO, ${aliado.nombre} aparece como la organización más afín (${aliado.similitud}% de similitud): ${aliado.posible_alianza} `
      : '')
    + 'IDEAPRO acompaña este proceso conectando conocimiento, capacidades y acción para generar valor público.';
}

export const _internal = { evaluacion, construirRutaCrecimiento, construirConclusion, profundizacionPorEnfoque, NIVEL_ETIQUETA };
