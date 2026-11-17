// =====================================================================
// Motor de inferencia · "si puedes deducirlo, no lo preguntes"
// ---------------------------------------------------------------------
// Un consultor senior no le pregunta a la Fundacion X que tipo de
// organizacion es, ni a una empresa que acaba de describir su software
// a que sector pertenece: lo deduce de lo que ya le contaron. Este
// modulo hace exactamente eso sobre las respuestas ya capturadas.
//
// Reglas del motor:
//  1. Solo infiere campos VACIOS. Nunca pisa una respuesta explicita.
//  2. Solo infiere hacia ADELANTE: los campos que deduce corresponden a
//     preguntas cuyo showIf es `(r) => !r.<campo>`, de modo que la
//     pregunta simplemente desaparece de la lista visible. Inferir un
//     campo ya preguntado desestabilizaria el indice de paso.
//  3. Deja rastro. Cada inferencia queda en `respuestas._inferidos`
//     con el valor, el origen y la evidencia, para que el diagnostico
//     pueda declarar que ese dato fue deducido y no declarado. Un dato
//     deducido que nadie puede auditar es un dato inventado.
// =====================================================================

function normalizar(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Coincidencia por raiz al inicio de palabra (misma regla que
// classification.js): "medic" no debe disparar dentro de "paramedico"
// ni "ti" dentro de "administrativo".
function coincide(texto, termino) {
  const escapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cierre = termino.length <= 3 ? '([^a-z0-9]|$)' : '';
  return new RegExp(`(^|[^a-z0-9])${escapado}${cierre}`, 'i').test(texto);
}

// ------------------------------------------------ tipo de organizacion
// La razon social casi siempre declara la naturaleza juridica. Solo se
// infiere cuando la senal es inequivoca; ante la duda se pregunta.
const NATURALEZA_POR_RAZON_SOCIAL = [
  { valor: 'fundacion', terminos: ['fundacion'] },
  { valor: 'universidad', terminos: ['universidad', 'institucion universitaria', 'politecnico', 'escuela superior'] },
  { valor: 'cooperativa', terminos: ['cooperativa', 'precooperativa'] },
  { valor: 'asociacion', terminos: ['asociacion', 'agremiacion', 'gremio'] },
  { valor: 'corporacion', terminos: ['corporacion'] },
  { valor: 'organizacion_social', terminos: ['ong', 'organizacion social', 'junta de accion comunal'] },
  { valor: 'empresa_privada', terminos: ['s a s', 'sas', 'ltda', 'limitada', 'sociedad anonima', 'unipersonal', 'sociedad por acciones'] },
];

function inferirTipoOrganizacion(respuestas) {
  const nombre = normalizar(respuestas.nombre).replace(/\./g, ' ').replace(/\s+/g, ' ');
  if (!nombre) return null;
  for (const regla of NATURALEZA_POR_RAZON_SOCIAL) {
    const termino = regla.terminos.find((t) => coincide(nombre, t));
    if (termino) {
      return { valor: regla.valor, origen: 'razon social', evidencia: termino };
    }
  }
  return null;
}

// ------------------------------------------------------------- sector
// Los nombres deben coincidir EXACTAMENTE con la tabla `sectores`
// (agentService busca el sector por nombre para leer su peso_ejes).
const LEXICO_SECTOR = {
  'Tecnologia e Informacion': [
    'software', 'plataforma', 'aplicativo', 'aplicacion', 'app', 'sistema de informacion',
    'digital', 'tecnolog', 'informatic', 'datos', 'analitica', 'nube', 'cloud',
    'ciberseguridad', 'inteligencia artificial', 'automatizacion', 'desarrollo web',
    'govtech', 'ti', 'internet de las cosas', 'iot', 'blockchain',
  ],
  'Construccion e Infraestructura': [
    'obra', 'construccion', 'infraestructura', 'via', 'vias', 'edificacion',
    'acueducto', 'alcantarillado', 'ingenieria civil', 'urbanism',
    'topograf', 'pavimento', 'saneamiento',
  ],
  'Salud y Servicios Medicos': [
    'salud', 'medic', 'hospital', 'clinic', 'ips', 'eps', 'farmac', 'enfermer',
    'psicolog', 'nutricion', 'odontolog', 'laboratorio clinico', 'telemedicina',
    'dispositivo medico', 'rehabilitacion',
  ],
  Agroindustria: [
    'agro', 'agricol', 'agropecuari', 'cultivo', 'campesin', 'pecuari', 'ganader',
    'cafe', 'cacao', 'panela', 'piscicultura', 'alimento', 'cadena productiva',
    'rural', 'siembra', 'cosecha',
  ],
  'Consultoria y Capacitacion': [
    'consultor', 'asesor', 'capacit', 'formacion', 'curso', 'diplomado', 'entrenamiento',
    'plan de desarrollo', 'politica publica', 'ordenamiento territorial', 'pot',
    'estudio', 'investigacion', 'acompanamiento tecnico',
    'planeacion', 'gestion del conocimiento', 'docencia', 'pedagog',
  ],
  'Suministros y Bienes': [
    'suministro', 'dotacion', 'comercializacion', 'distribucion', 'venta de equipos',
    'mobiliario', 'papeleria', 'ferreteria', 'logistica', 'transporte de carga',
    'insumos', 'maquinaria',
  ],
};

const CAMPOS_TEXTO_OFERTA = ['tipo_bien_servicio', 'problema_que_resuelve', 'diferenciador'];

function inferirSector(respuestas) {
  const texto = normalizar(CAMPOS_TEXTO_OFERTA.map((c) => respuestas[c]).filter(Boolean).join(' . '));
  if (!texto) return null;

  const puntajes = Object.entries(LEXICO_SECTOR)
    .map(([sector, terminos]) => {
      const aciertos = terminos.filter((t) => coincide(texto, t));
      return { sector, aciertos, puntaje: aciertos.length };
    })
    .filter((s) => s.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje);

  if (puntajes.length === 0) return null;
  // Empate tecnico: la organizacion toca dos mundos y la eleccion del
  // sector cambia el peso de los ejes. Eso se pregunta, no se adivina.
  if (puntajes.length > 1 && puntajes[0].puntaje === puntajes[1].puntaje) return null;

  return {
    valor: puntajes[0].sector,
    origen: 'descripcion de la oferta',
    evidencia: puntajes[0].aciertos.slice(0, 3).join(', '),
  };
}

// -------------------------------------------------- entidades objetivo
// Si la organizacion ya nombro entidades publicas al describir su reto
// o su objetivo, preguntarle "a que entidades quieren llegar" seria
// hacerle repetir lo que acaba de decir.
const ENTIDADES_RECONOCIBLES = [
  'alcaldia', 'alcaldias', 'gobernacion', 'gobernaciones', 'ministerio', 'ministerios',
  'hospital', 'hospitales', 'universidad publica', 'universidades publicas',
  'sena', 'icbf', 'dnp', 'dane', 'colombia compra', 'secretaria', 'secretarias',
  'municipio', 'municipios', 'gobierno nacional', 'entidad territorial',
  'entidades territoriales', 'corporacion autonoma', 'personeria', 'contraloria',
];

const CAMPOS_TEXTO_INTENCION = [
  'objetivo_6_meses', 'reto_actual', 'problema_que_resuelve', 'diferenciador', 'tipo_bien_servicio',
];

function inferirEntidadesObjetivo(respuestas) {
  const texto = normalizar(CAMPOS_TEXTO_INTENCION.map((c) => respuestas[c]).filter(Boolean).join(' . '));
  if (!texto) return null;
  const encontradas = ENTIDADES_RECONOCIBLES.filter((e) => coincide(texto, e));
  if (encontradas.length === 0) return null;
  return {
    valor: encontradas.slice(0, 4).join(', '),
    origen: 'entidades mencionadas en la conversacion',
    evidencia: encontradas.slice(0, 4).join(', '),
  };
}

// --------------------------------------------------------------- API
const REGLAS = [
  { campo: 'tipo_organizacion', inferir: inferirTipoOrganizacion, empresaField: 'tipo_organizacion' },
  { campo: 'sector_texto', inferir: inferirSector, empresaField: 'sector_texto' },
  { campo: 'entidades_objetivo', inferir: inferirEntidadesObjetivo, empresaField: null },
];

/**
 * Aplica todas las inferencias posibles sobre un set de respuestas.
 * No muta la entrada.
 * @param {object} respuestas respuestas planas de la sesion
 * @returns {{respuestas: object, inferidos: object, empresaFields: object, hubo: boolean}}
 */
export function aplicarInferencias(respuestas = {}) {
  const resultado = { ...respuestas };
  const registro = { ...(respuestas._inferidos || {}) };
  const nuevos = {};
  const empresaFields = {};

  for (const regla of REGLAS) {
    const actual = resultado[regla.campo];
    if (actual !== undefined && actual !== null && actual !== '') continue;
    const deduccion = regla.inferir(resultado);
    if (!deduccion) continue;
    resultado[regla.campo] = deduccion.valor;
    registro[regla.campo] = {
      valor: deduccion.valor,
      origen: deduccion.origen,
      evidencia: deduccion.evidencia,
    };
    nuevos[regla.campo] = registro[regla.campo];
    if (regla.empresaField) empresaFields[regla.empresaField] = deduccion.valor;
  }

  const hubo = Object.keys(nuevos).length > 0;
  if (hubo) resultado._inferidos = registro;
  return { respuestas: resultado, inferidos: registro, nuevos, empresaFields, hubo };
}

const ETIQUETAS_INFERENCIA = {
  tipo_organizacion: 'el tipo de organización',
  sector_texto: 'el sector económico',
  entidades_objetivo: 'las entidades públicas objetivo',
};

/** Etiquetas legibles de lo deducido, para que el agente lo declare. */
export function describirInferencias(inferidos = {}) {
  return Object.entries(inferidos).map(([campo, dato]) => ({
    campo,
    etiqueta: ETIQUETAS_INFERENCIA[campo] || campo,
    valor: dato.valor,
    origen: dato.origen,
  }));
}

export const _internal = {
  normalizar, coincide, inferirTipoOrganizacion, inferirSector, inferirEntidadesObjetivo,
};
