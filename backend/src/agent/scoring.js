// =====================================================================
// ETAPAS 5 a 11 · Motor de evaluacion de capacidades y madurez
// ---------------------------------------------------------------------
// Convierte las respuestas de la conversacion en:
//   - 6 puntajes de eje (0-100), que son la columna vertebral del
//     modelo de datos (diagnosticos.score_*),
//   - 6 dimensiones IDEAPRO derivadas (tecnica, juridica_documental,
//     financiera, oferta_propuesta_valor, ecosistema_publico y
//     comercial_publica), que son las que exige el protocolo Nexus,
//   - riesgo financiero (bajo / medio / alto),
//   - nivel de madurez 1-5 calculado con penalizaciones (NO promedio),
//   - detector de brechas en las 6 familias del protocolo (tecnicas,
//     juridicas, financieras, comerciales, institucionales y
//     tecnologicas) con impacto, riesgo, urgencia y recomendacion.
//
// La rubrica es deterministica, explicable y auditable: es un producto
// comercial, no una caja negra. La IA generativa solo redacta encima
// de estos numeros, nunca los produce.
//
// Cada eje parte de un piso de 5 puntos (organizacion sin datos aun se
// considera "inicial", nunca 0 absoluto) y suma por cada senal
// positiva detectada, con techo de 100.
// =====================================================================

import { evaluarElegibilidad } from './eligibility.js';

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const RANGO_VENTAS_PUNTOS = {
  menos_100m: 8,
  '100m_500m': 18,
  '500m_2000m': 28,
  mas_2000m: 36,
};

const CRECIMIENTO_PUNTOS = {
  decrecio: 0,
  estable: 5,
  crecio: 9,
  crecio_fuerte: 12,
};

const ENDEUDAMIENTO_PUNTOS = {
  bajo: 12,
  medio: 7,
  alto: 0,
  no_sabe: 2,
};

const COBERTURA_PUNTOS = {
  local: 4,
  departamental: 8,
  regional: 12,
  nacional: 16,
};

const MADUREZ_TEC_PUNTOS = {
  basica: 3,
  intermedia: 8,
  avanzada: 13,
  producto_digital: 16,
};

// --------------------------------------------------------------- ejes

function scoreLegal(r) {
  let s = 5;
  s += r.tiene_rup === true ? 30 : 5;
  s += r.camara_comercio === true ? 18 : 0;
  s += r.gestion_documental === true ? 20 : 0;
  s += r.conoce_pliegos === true ? 17 : 3;
  s += r.certificaciones === true ? 8 : 0;
  s += tieneFacultades(r) ? 5 : 0;
  return clamp(s);
}

function scoreExperiencia(r) {
  let s = 5;
  const anios = Number(r.anios_operacion) || 0;
  s += Math.min(15, anios * 1.5);
  s += r.experiencia_proyectos === true ? 12 : 0;
  s += r.experiencia_previa_contratos === true ? 22 : 3;
  const contratos = Number(r.num_contratos_previos) || 0;
  s += Math.min(15, contratos * 3);
  const casos = Number(r.casos_exito) || 0;
  s += Math.min(16, casos * 4);
  s += r.certificaciones === true ? 15 : 3;
  return clamp(Math.round(s));
}

function scoreOperativa(r) {
  let s = 5;
  const equipo = Number(r.tamanio_equipo) || 0;
  s += Math.min(22, equipo * 2);
  s += r.procesos_documentados === true ? 22 : 4;
  s += r.capacidad_operativa === true ? 15 : 0;
  s += r.capacidad_escalar === true ? 12 : 0;
  s += COBERTURA_PUNTOS[r.cobertura_territorial] ?? 4;
  s += MADUREZ_TEC_PUNTOS[r.madurez_tecnologica] ?? 3;
  return clamp(Math.round(s));
}

function scoreFinanciera(r) {
  let s = 5;
  s += RANGO_VENTAS_PUNTOS[r.rango_ventas] ?? 6;
  s += r.ventas_registradas === true ? 10 : 0;
  s += r.capital_trabajo === true ? 14 : 0;
  s += r.flujo_caja === true ? 12 : 0;
  s += r.capacidad_garantias === true ? 14 : 2;
  s += CRECIMIENTO_PUNTOS[r.crecimiento_ventas] ?? 3;
  s += ENDEUDAMIENTO_PUNTOS[r.endeudamiento] ?? 2;
  return clamp(Math.round(s));
}

function scoreComercial(r) {
  let s = 5;
  s += r.equipo_comercial_dedicado === true ? 18 : 3;
  s += r.conoce_secop === true ? 20 : 3;
  s += r.conoce_planes_desarrollo === true ? 16 : 0;
  s += r.conoce_mga === true ? 16 : 0;
  s += tieneEntidadesObjetivo(r) ? 10 : 0;
  s += tieneWeb(r) ? 8 : 0;
  const diferenciador = texto(r.diferenciador);
  s += diferenciador.length > 15 ? 7 : diferenciador.length > 0 ? 3 : 0;
  return clamp(s);
}

// La oferta se puntúa por RIQUEZA de la respuesta, no solo por su
// longitud: describir el servicio, el problema y el diferenciador con
// detalle indica una propuesta de valor construida. El techo natural
// (87) deja margen deliberado: los últimos puntos solo se alcanzan
// cuando la organización, además, articula su objetivo público.
function scoreOferta(r) {
  let s = 5;
  const tipo = texto(r.tipo_bien_servicio);
  s += tipo.length > 20 ? 24 : tipo.length > 5 ? 15 : tipo.length > 0 ? 7 : 0;
  // La profundizacion `problema_detallado` se abre justamente cuando el
  // problema llego enunciado de forma demasiado general: si al
  // preguntarle la organizacion lo concreto, ese esfuerzo cuenta.
  const problema = [texto(r.problema_que_resuelve), texto(r.problema_detallado)]
    .filter(Boolean).join(' ');
  s += problema.length > 25 ? 26 : problema.length > 8 ? 16 : problema.length > 0 ? 7 : 0;
  const diferenciador = texto(r.diferenciador);
  s += diferenciador.length > 20 ? 22 : diferenciador.length > 0 ? 10 : 0;
  s += r.sector_texto ? 6 : 0;
  s += texto(r.objetivo_6_meses).length > 15 ? 4 : 0;
  return clamp(s);
}

// ------------------------------------------------------------ helpers

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function esNegativo(valor) {
  const t = normalizar(valor);
  return !t || /^(no|ninguna|ninguno|n\/a|na|nada|aun no|todavia no|-)$/.test(t);
}

function tieneWeb(r) {
  return !esNegativo(r.sitio_web);
}

function tieneEntidadesObjetivo(r) {
  return !esNegativo(r.entidades_objetivo);
}

// Un representante legal o cargo directivo puede suscribir la oferta
// sin autorizacion adicional; un cargo operativo obliga a prever un
// tramite de facultades ante la junta antes de presentarse.
function tieneFacultades(r) {
  const cargo = normalizar(r.cargo_contacto);
  return /(representante|gerente|director|presidente|rector|ceo|propietari|dueñ|duen|socio|fundador|administrador)/.test(cargo);
}

const DEFAULT_WEIGHTS = {
  oferta: 1, experiencia: 1, operativa: 1, legal: 1, financiera: 1, comercial: 1,
};

// ------------------------------------------------- interpretacion 0-100

const BANDAS = [
  { max: 20, nivel: 'muy_debil', etiqueta: 'Muy débil' },
  { max: 40, nivel: 'inicial', etiqueta: 'Inicial' },
  { max: 60, nivel: 'en_desarrollo', etiqueta: 'En desarrollo' },
  { max: 80, nivel: 'solida', etiqueta: 'Sólida' },
  { max: 100, nivel: 'avanzada', etiqueta: 'Avanzada' },
];

export function interpretarPuntaje(score) {
  const banda = BANDAS.find((b) => score <= b.max) || BANDAS[BANDAS.length - 1];
  return { nivel: banda.nivel, etiqueta: banda.etiqueta };
}

// ------------------------------------------------------ riesgo financiero

export function evaluarRiesgoFinanciero(r, scoreFin) {
  const alertas = [];
  if (r.ventas_registradas !== true) alertas.push('Sin ingresos registrados contablemente en el último año.');
  if (r.capital_trabajo !== true) alertas.push('Sin capital de trabajo propio para arrancar la ejecución.');
  if (r.flujo_caja !== true) alertas.push('El flujo de caja no soporta 2-3 meses de operación sin pagos.');
  if (r.capacidad_garantias !== true) alertas.push('No hay experiencia gestionando pólizas ni garantías de cumplimiento.');
  if (r.endeudamiento === 'alto') alertas.push('Nivel de endeudamiento superior al 60% de los activos.');
  if (r.endeudamiento === 'no_sabe') alertas.push('El nivel de endeudamiento no está monitoreado.');
  if (r.crecimiento_ventas === 'decrecio') alertas.push('Los ingresos decrecieron frente al año anterior.');
  if (r.rango_ventas === 'menos_100m') alertas.push('El volumen de ingresos limita la cuantía a la que se puede aspirar.');

  const nivel = alertas.length >= 4 || scoreFin < 35
    ? 'alto'
    : alertas.length >= 2 || scoreFin < 60
      ? 'medio'
      : 'bajo';

  return {
    nivel,
    alertas,
    interpretacion: nivel === 'alto'
      ? 'Riesgo financiero ALTO: la organización no debería comprometerse con contratos que exijan anticipos de recursos propios ni pólizas de alto valor hasta fortalecer su estructura.'
      : nivel === 'medio'
        ? 'Riesgo financiero MEDIO: es viable participar en procesos de cuantía baja o media, cuidando la exposición simultánea y el respaldo de garantías.'
        : 'Riesgo financiero BAJO: la estructura financiera soporta la ejecución de contratos públicos en condiciones normales de pago.',
  };
}

// -------------------------------------------- nivel de madurez 1 a 5

export const NIVELES_MADUREZ = {
  1: { clave: 'exploracion', nombre: 'Exploración', descripcion: 'La organización apenas está reconociendo el mercado público. Necesita construir bases antes de postular.' },
  2: { clave: 'preparacion', nombre: 'Preparación', descripcion: 'Existe intención y algunas capacidades, pero hay brechas habilitantes que impiden competir.' },
  3: { clave: 'lista_para_explorar', nombre: 'Lista para explorar', descripcion: 'La organización puede empezar a presentarse a procesos de cuantía baja mientras cierra brechas puntuales.' },
  4: { clave: 'preparada', nombre: 'Preparada', descripcion: 'Cumple los habilitantes y tiene capacidad de ejecución: puede competir de forma sostenida.' },
  5: { clave: 'consolidada', nombre: 'Consolidada', descripcion: 'Organización madura, con trayectoria pública verificable y capacidad de ejecución simultánea.' },
};

// El nivel NO es un promedio: una organización puede tener un índice
// alto y aun así no ser elegible (sin RUP, sin capital de trabajo, sin
// experiencia acreditable). Por eso se calcula un nivel base a partir
// del índice y luego se aplican TECHOS por brechas críticas y riesgos.
function calcularNivelMadurez({ indice, scores, elegibilidad, riesgoFinanciero, respuestas }) {
  let nivel = indice <= 200 ? 1 : indice <= 400 ? 2 : indice <= 600 ? 3 : indice <= 800 ? 4 : 5;
  const nivelBase = nivel;
  const penalizaciones = [];

  const aplicarTecho = (techo, motivo) => {
    if (nivel > techo) {
      nivel = techo;
      penalizaciones.push({ techo, motivo });
    }
  };

  if (elegibilidad.estado === 'no_elegible') {
    aplicarTecho(1, 'No se cumple el requisito mínimo de antigüedad para contratar con el Estado.');
  }
  if (elegibilidad.estado === 'riesgo') {
    aplicarTecho(3, `Hay ${elegibilidad.riesgos.length} condición(es) habilitante(s) sin cumplir.`);
  }
  const ejeMuyDebil = Object.entries(scores).find(([, valor]) => valor < 30);
  if (ejeMuyDebil) {
    aplicarTecho(2, `El eje "${BRECHA_LABELS[ejeMuyDebil[0]]}" está en ${ejeMuyDebil[1]}/100: es una brecha crítica que bloquea el avance.`);
  }
  if (scores.legal < 50) {
    aplicarTecho(3, 'La capacidad jurídica y documental no alcanza el mínimo para superar los requisitos habilitantes.');
  }
  // Habilitantes duros: por muy alto que sea el índice, sin estos
  // documentos la organización no puede ser proponente. Un promedio
  // simple los diluiría; aquí actúan como techo explícito.
  if (respuestas.camara_comercio !== true) {
    aplicarTecho(2, 'Sin registro mercantil renovado la organización no acredita existencia y representación legal.');
  }
  if (respuestas.tiene_rup !== true) {
    aplicarTecho(3, 'Sin RUP inscrito y actualizado no es posible presentarse como proponente en la mayoría de los procesos.');
  }
  if (respuestas.gestion_documental !== true) {
    aplicarTecho(3, 'Sin expediente documental organizado la organización no alcanza a acreditar los requisitos dentro de los plazos del proceso.');
  }
  if (riesgoFinanciero.nivel === 'alto') {
    aplicarTecho(2, 'El riesgo financiero alto impide asumir compromisos contractuales con el Estado.');
  }
  if (respuestas.experiencia_previa_contratos !== true) {
    aplicarTecho(4, 'Sin contratos públicos ejecutados no es posible acreditar la trayectoria de una organización consolidada.');
  }
  if (respuestas.capacidad_escalar !== true) {
    aplicarTecho(4, 'No hay capacidad demostrada para ejecutar contratos simultáneos.');
  }

  return { nivel, nivelBase, penalizaciones, ...NIVELES_MADUREZ[nivel] };
}

// ------------------------------------------------ detector de brechas

const BRECHA_LABELS = {
  oferta: 'Oferta y propuesta de valor',
  experiencia: 'Experiencia y capacidad demostrable',
  operativa: 'Capacidad técnica y operativa',
  legal: 'Capacidad jurídica y documental',
  financiera: 'Capacidad financiera y garantías',
  comercial: 'Conocimiento del ecosistema público',
};

// Familias de brecha exigidas por el protocolo (etapa 9).
const FAMILIAS_BRECHA = {
  tecnica: {
    nombre: 'Brechas técnicas',
    dimension: 'tecnica',
    impacto: 'Limita la capacidad de responder a los requisitos técnicos del pliego y de ejecutar sin incumplir plazos.',
    riesgo: 'Descalificación técnica en la evaluación o incumplimiento durante la ejecución.',
    faltantes: [
      { condicion: (r) => r.procesos_documentados !== true, texto: 'metodología y procesos documentados' },
      { condicion: (r) => r.capacidad_escalar !== true, texto: 'capacidad de ejecución simultánea' },
      { condicion: (r) => Number(r.casos_exito) < 2, texto: 'casos de éxito documentados y certificables' },
      { condicion: (r) => r.capacidad_operativa !== true, texto: 'capacidad operativa disponible' },
    ],
    recomendacion: 'Documentar la metodología, levantar el portafolio de casos de éxito con evidencia verificable y dimensionar la capacidad instalada antes de comprometerse con un contrato.',
  },
  juridica: {
    nombre: 'Brechas jurídicas',
    dimension: 'juridica_documental',
    impacto: 'Impide superar los requisitos habilitantes: sin ellos la propuesta ni siquiera se evalúa.',
    riesgo: 'Rechazo de la oferta en la verificación jurídica, sin posibilidad de subsanar.',
    faltantes: [
      { condicion: (r) => r.tiene_rup !== true, texto: 'RUP inscrito y actualizado' },
      { condicion: (r) => r.camara_comercio !== true, texto: 'registro mercantil renovado' },
      { condicion: (r) => r.gestion_documental !== true, texto: 'expediente documental organizado' },
      { condicion: (r) => r.conoce_pliegos !== true, texto: 'lectura e interpretación de pliegos' },
      { condicion: (r) => !tieneFacultades(r), texto: 'verificación de facultades del representante' },
    ],
    recomendacion: 'Estructurar el RUP, renovar los registros y consolidar el expediente documental (financieros, experiencia, seguridad social) en un repositorio único y vigente.',
  },
  financiera: {
    nombre: 'Brechas financieras',
    dimension: 'financiera',
    impacto: 'Restringe la cuantía a la que se puede aspirar y la capacidad de sostener la ejecución.',
    riesgo: 'Incumplimiento por falta de liquidez y efectividad de las garantías.',
    faltantes: [
      { condicion: (r) => r.capital_trabajo !== true, texto: 'capital de trabajo' },
      { condicion: (r) => r.flujo_caja !== true, texto: 'colchón de flujo de caja' },
      { condicion: (r) => r.capacidad_garantias !== true, texto: 'gestión de pólizas y garantías' },
      { condicion: (r) => r.endeudamiento === 'alto' || r.endeudamiento === 'no_sabe', texto: 'control del nivel de endeudamiento' },
      { condicion: (r) => r.ventas_registradas !== true, texto: 'ingresos registrados contablemente' },
    ],
    recomendacion: 'Construir los indicadores financieros habilitantes, abrir cupo con una aseguradora y definir el tope de exposición simultánea antes de postular.',
  },
  comercial: {
    nombre: 'Brechas comerciales',
    dimension: 'comercial_publica',
    impacto: 'La organización no logra traducir su oferta al lenguaje ni a los criterios de compra del Estado.',
    riesgo: 'Esfuerzo comercial disperso, sin conversión en procesos ganados.',
    faltantes: [
      { condicion: (r) => r.equipo_comercial_dedicado !== true, texto: 'responsable dedicado a oportunidades públicas' },
      { condicion: (r) => !tieneEntidadesObjetivo(r), texto: 'entidades objetivo priorizadas' },
      { condicion: (r) => !tieneWeb(r), texto: 'presencia institucional en línea' },
      { condicion: (r) => String(r.diferenciador || '').trim().length < 15, texto: 'diferenciador competitivo explícito' },
    ],
    recomendacion: 'Definir el segmento de entidades objetivo, construir una ficha institucional en lenguaje de valor público y asignar un responsable de la gestión comercial pública.',
  },
  institucional: {
    nombre: 'Brechas institucionales',
    dimension: 'ecosistema_publico',
    impacto: 'Sin comprensión del ciclo de la inversión pública la organización llega tarde: cuando el proceso ya está publicado, la necesidad lleva un año definida.',
    riesgo: 'Participación reactiva, en procesos donde otro proveedor ya estructuró la necesidad.',
    faltantes: [
      { condicion: (r) => r.conoce_secop !== true, texto: 'monitoreo de SECOP II / Colombia Compra Eficiente' },
      { condicion: (r) => r.conoce_planes_desarrollo !== true, texto: 'lectura de planes de desarrollo territoriales' },
      { condicion: (r) => r.conoce_mga !== true, texto: 'conocimiento de MGA, bancos de proyectos y SGR' },
      { condicion: (r) => r.experiencia_previa_contratos !== true, texto: 'relacionamiento institucional previo' },
    ],
    recomendacion: 'Instalar una rutina de inteligencia territorial: monitoreo de SECOP II, lectura de planes de desarrollo y de planes anuales de adquisiciones de las entidades objetivo.',
  },
  tecnologica: {
    nombre: 'Brechas tecnológicas',
    dimension: 'tecnologica',
    impacto: 'Reduce la eficiencia interna y la capacidad de competir en procesos de transformación digital y GovTech.',
    riesgo: 'Costos operativos altos y pérdida de oportunidades en la agenda de modernización del Estado.',
    faltantes: [
      { condicion: (r) => ['basica', undefined, null, ''].includes(r.madurez_tecnologica), texto: 'herramientas digitales de gestión' },
      { condicion: (r) => !tieneWeb(r), texto: 'presencia digital verificable' },
      { condicion: (r) => r.procesos_documentados !== true, texto: 'procesos digitalizables documentados' },
    ],
    recomendacion: 'Digitalizar la operación interna (gestión documental, trazabilidad de proyectos) como paso previo a ofrecer soluciones de modernización a terceros.',
  },
};

function urgenciaDesde(score, cantidadFaltantes) {
  if (score < 40 || cantidadFaltantes >= 3) return 'inmediata';
  if (score < 60 || cantidadFaltantes === 2) return 'alta';
  if (score < 75 || cantidadFaltantes === 1) return 'media';
  return 'baja';
}

function severidadDesde(score) {
  return score < 40 ? 'critica' : score < 60 ? 'alta' : score < 75 ? 'media' : 'baja';
}

// Brechas por EJE (compatibilidad con el radar y el encaje de
// oportunidades, que razonan sobre los seis ejes del modelo de datos).
function identificarBrechas(scores, respuestas, pesoEjes) {
  return Object.entries(scores)
    .map(([eje, score]) => {
      const peso = Number(pesoEjes?.[eje]) || 1;
      const faltantes = [];
      if (eje === 'legal' && respuestas.tiene_rup !== true) faltantes.push('RUP vigente');
      if (eje === 'legal' && respuestas.camara_comercio !== true) faltantes.push('registro mercantil renovado');
      if (eje === 'legal' && respuestas.conoce_pliegos !== true) faltantes.push('lectura de pliegos');
      if (eje === 'legal' && respuestas.gestion_documental !== true) faltantes.push('expediente documental');
      if (eje === 'financiera' && respuestas.capacidad_garantias !== true) faltantes.push('gestión de garantías');
      if (eje === 'financiera' && respuestas.capital_trabajo !== true) faltantes.push('capital de trabajo');
      if (eje === 'financiera' && respuestas.flujo_caja !== true) faltantes.push('colchón de flujo de caja');
      if (eje === 'operativa' && respuestas.procesos_documentados !== true) faltantes.push('procesos documentados');
      if (eje === 'operativa' && respuestas.capacidad_escalar !== true) faltantes.push('capacidad de ejecución simultánea');
      if (eje === 'comercial' && respuestas.conoce_secop !== true) faltantes.push('conocimiento de SECOP II');
      if (eje === 'comercial' && respuestas.conoce_planes_desarrollo !== true) faltantes.push('lectura de planes de desarrollo');
      if (eje === 'comercial' && respuestas.conoce_mga !== true) faltantes.push('formulación de proyectos (MGA/SGR)');
      if (eje === 'experiencia' && respuestas.experiencia_previa_contratos !== true) faltantes.push('contratos públicos ejecutados');
      if (eje === 'experiencia' && Number(respuestas.casos_exito) < 2) faltantes.push('casos de éxito certificables');
      if (eje === 'oferta' && String(respuestas.problema_que_resuelve || '').trim().length < 10) faltantes.push('problema público claramente formulado');
      return {
        eje,
        nombre: BRECHA_LABELS[eje],
        score,
        deficit: 100 - score,
        criticidad: Math.round((100 - score) * peso),
        severidad: severidadDesde(score),
        urgencia: urgenciaDesde(score, faltantes.length),
        faltantes,
      };
    })
    .filter((brecha) => brecha.deficit > 0)
    .sort((a, b) => b.criticidad - a.criticidad);
}

// Brechas por FAMILIA (etapa 9 del protocolo): siempre se
// reportan las seis, cada una con impacto, riesgo, urgencia y
// recomendacion, aunque su estado sea "sin brecha".
function identificarBrechasPorFamilia(dimensiones, respuestas) {
  return Object.entries(FAMILIAS_BRECHA).map(([id, familia]) => {
    const score = dimensiones[familia.dimension] ?? 0;
    const faltantes = familia.faltantes
      .filter((item) => item.condicion(respuestas))
      .map((item) => item.texto);
    const urgencia = faltantes.length === 0 && score >= 75 ? 'baja' : urgenciaDesde(score, faltantes.length);

    return {
      id,
      nombre: familia.nombre,
      score,
      severidad: severidadDesde(score),
      urgencia,
      faltantes,
      impacto: familia.impacto,
      riesgo: familia.riesgo,
      recomendacion: familia.recomendacion,
      estado: faltantes.length === 0 && score >= 75 ? 'sin_brecha' : 'con_brecha',
    };
  }).sort((a, b) => {
    const orden = { inmediata: 0, alta: 1, media: 2, baja: 3 };
    return orden[a.urgencia] - orden[b.urgencia] || a.score - b.score;
  });
}

// El eje crítico no es simplemente "el puntaje más bajo": una
// organización en un sector donde lo "legal" pesa mucho (p. ej.
// construcción) sufre más por debilidad legal que otra en un sector
// donde ese eje pesa poco. Por eso ponderamos el déficit (100 - score)
// por el peso del sector antes de elegir el eje más crítico.
function identificarEjeCritico(scores, pesoEjes) {
  let peorEje = null;
  let peorCriticidad = -Infinity;

  for (const [eje, score] of Object.entries(scores)) {
    const peso = pesoEjes?.[eje] ?? 1;
    const criticidad = (100 - score) * peso;
    if (criticidad > peorCriticidad) {
      peorCriticidad = criticidad;
      peorEje = eje;
    }
  }
  return peorEje;
}

// --------------------------------------------- dimensiones IDEAPRO

function calcularDimensiones(scores, r) {
  const ecosistema = clamp(Math.round(
    5
    + (r.conoce_secop === true ? 30 : 0)
    + (r.conoce_planes_desarrollo === true ? 25 : 0)
    + (r.conoce_mga === true ? 25 : 0)
    + (r.experiencia_previa_contratos === true ? 15 : 0)
  ));

  const comercialPublica = clamp(Math.round(
    5
    + (r.equipo_comercial_dedicado === true ? 25 : 0)
    + (tieneEntidadesObjetivo(r) ? 20 : 0)
    + (tieneWeb(r) ? 12 : 0)
    + (String(r.diferenciador || '').trim().length > 15 ? 18 : 0)
    + (String(r.objetivo_6_meses || '').trim().length > 15 ? 10 : 0)
    + (r.conoce_secop === true ? 10 : 0)
  ));

  const tecnologica = clamp(Math.round(
    5
    + (MADUREZ_TEC_PUNTOS[r.madurez_tecnologica] ?? 3) * 4
    + (tieneWeb(r) ? 15 : 0)
    + (r.procesos_documentados === true ? 15 : 0)
  ));

  return {
    tecnica: Math.round((scores.experiencia + scores.operativa) / 2),
    juridica_documental: scores.legal,
    financiera: scores.financiera,
    oferta_propuesta_valor: scores.oferta,
    ecosistema_publico: ecosistema,
    comercial_publica: comercialPublica,
    tecnologica,
  };
}

// ------------------------------------------------------------ publico

/**
 * Calcula el diagnóstico completo a partir de las respuestas.
 * @param {object} respuestas - respuestas planas { id_pregunta: valor }
 * @param {object} pesoEjes - peso_ejes del sector (opcional)
 */
export function calcularDiagnostico(respuestas, pesoEjes = DEFAULT_WEIGHTS) {
  const scores = {
    oferta: scoreOferta(respuestas),
    experiencia: scoreExperiencia(respuestas),
    operativa: scoreOperativa(respuestas),
    legal: scoreLegal(respuestas),
    financiera: scoreFinanciera(respuestas),
    comercial: scoreComercial(respuestas),
  };

  // El índice replica exactamente la columna generada de la base de
  // datos (diagnosticos.indice_ideapro): suma de ejes * 10 / 6.
  const indiceIdeapro = Math.round(
    (Object.values(scores).reduce((a, b) => a + b, 0) * 10) / 6
  );

  const elegibilidad = evaluarElegibilidad(respuestas);
  const riesgoFinanciero = evaluarRiesgoFinanciero(respuestas, scores.financiera);
  const madurez = calcularNivelMadurez({ indice: indiceIdeapro, scores, elegibilidad, riesgoFinanciero, respuestas });
  const dimensionesIdeapro = calcularDimensiones(scores, respuestas);
  const ejeCritico = identificarEjeCritico(scores, pesoEjes);
  const brechas = identificarBrechas(scores, respuestas, pesoEjes);
  const brechasPorFamilia = identificarBrechasPorFamilia(dimensionesIdeapro, respuestas);

  const interpretacionEjes = Object.fromEntries(
    Object.entries(scores).map(([eje, score]) => [eje, { score, nombre: BRECHA_LABELS[eje], ...interpretarPuntaje(score) }])
  );

  const fortalezas = Object.entries(scores)
    .filter(([, score]) => score >= 60)
    .sort((a, b) => b[1] - a[1])
    .map(([eje, score]) => ({ eje, nombre: BRECHA_LABELS[eje], score, ...interpretarPuntaje(score) }));

  return {
    scores,
    indiceIdeapro,
    // nivelMadurezGlobal conserva la clave textual que persiste en la
    // columna nivel_madurez_global (enum de la base de datos).
    nivelMadurezGlobal: madurez.clave,
    nivelMadurez: madurez,
    elegibilidad,
    riesgoFinanciero,
    ejeCritico,
    brechas,
    brechasPorFamilia,
    fortalezas,
    interpretacionEjes,
    dimensionesIdeapro,
    radarData: scores,
  };
}

export const _internal = {
  scoreLegal, scoreExperiencia, scoreOperativa, scoreFinanciera, scoreComercial, scoreOferta,
  calcularNivelMadurez, identificarEjeCritico, identificarBrechas, identificarBrechasPorFamilia,
  calcularDimensiones, tieneFacultades, tieneWeb, tieneEntidadesObjetivo, BRECHA_LABELS,
};
