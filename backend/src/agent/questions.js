// =====================================================================
// Flujo conversacional de IDEAPRO Intelligence AI
// ---------------------------------------------------------------------
// Esto NO es un formulario: es la reunión de cinco minutos que un
// consultor senior tiene con un empresario. El orden es fijo y no se
// altera, porque es el orden en que se entiende una organización:
//
//   1. ¿Quiénes son?
//   2. ¿Qué hacen?
//   3. ¿Qué problema resuelven?
//   4. ¿Tienen capacidad para ejecutarlo?
//   5. ¿Tienen experiencia con el sector público?
//   6. ¿Qué les falta para crecer?
//
// PRESUPUESTO DE PREGUNTAS: 13 turnos fijos + 2 condicionales (los que
// el motor de inferencia no logró deducir) = 15 como máximo, más hasta
// 3 profundizaciones adaptativas. Nunca más. Si el agente ya tiene
// suficiente información, se detiene y entrega el diagnóstico.
//
// Tres mecanismos permiten sostener ese presupuesto sin perder ni una
// sola de las señales que la rúbrica determinista necesita:
//
//   a) `multi`  · un checklist que se responde en UN turno y deriva N
//                 booleanos. Cinco preguntas de sí/no sobre alistamiento
//                 jurídico son una sola conversación real.
//   b) `form`   · varios campos en una sola burbuja, como cuando un
//                 consultor pregunta "¿ciudad, departamento y web?".
//   c) inferencia · lo deducible no se pregunta (ver inference.js).
//
// Cada paso define:
//  - id: identificador único; para `text|number|boolean|select` es
//        también la llave en sesiones.respuestas. Para `multi` y `form`
//        la llave contenedora, y las llaves reales las aportan sus
//        options/campos (ver derivarRespuestas).
//  - empresaField: si existe, la respuesta persiste en `empresas`.
//  - etapa: fase de la metodología (1..6, 7 = profundización).
//  - bloque: título legible, se usa como separador visual en el chat.
//  - dimension: eje de madurez que ese dato calibra (o null).
//  - type: 'text' | 'textarea' | 'number' | 'boolean' | 'select'
//          | 'multi' | 'form'
//  - required: si el agente debe insistir cuando llega vacío.
//  - showIf: pregunta condicional. REGLA: la condición solo puede
//        depender de respuestas ANTERIORES a la propia pregunta, porque
//        el índice de paso se recalcula sobre la lista visible y una
//        condición inestable haría saltar o repetir preguntas. Por eso
//        las profundizaciones leen un plan CONGELADO (_profundizacion)
//        y no un detector que su propia respuesta podría apagar.
// =====================================================================

import { seProfundizaEn } from './sufficiency.js';

export const ETAPAS = {
  1: '¿Quiénes son?',
  2: '¿Qué hacen?',
  3: '¿Qué problema resuelven?',
  4: '¿Tienen capacidad para ejecutarlo?',
  5: '¿Tienen experiencia con el sector público?',
  6: '¿Qué les falta para crecer?',
  7: 'Profundización',
};

// Campos que se heredan de un diagnóstico anterior de la MISMA
// organización (memoria inteligente). Son los datos de identidad, que
// no cambian entre diagnósticos; las capacidades no se heredan nunca,
// porque medirlas de nuevo es justamente el objeto de un segundo
// diagnóstico.
export const CAMPOS_MEMORIA = [
  'tipo_organizacion', 'nombre_contacto', 'cargo_contacto', 'correo_contacto',
  'ubicacion_ciudad', 'ubicacion_departamento', 'sitio_web', 'sector_texto',
];

export const TIPOS_ORGANIZACION = [
  { value: 'empresa_privada', label: 'Empresa privada' },
  { value: 'fundacion', label: 'Fundación' },
  { value: 'universidad', label: 'Universidad o institución educativa' },
  { value: 'cooperativa', label: 'Cooperativa' },
  { value: 'asociacion', label: 'Asociación / gremio' },
  { value: 'consultora', label: 'Consultora' },
  { value: 'empresa_tecnologica', label: 'Empresa tecnológica' },
  { value: 'organizacion_social', label: 'Organización social / ONG' },
  { value: 'corporacion', label: 'Corporación' },
  { value: 'otra', label: 'Otra' },
];

const COBERTURA_OPCIONES = [
  { value: 'local', label: 'Solo nuestro municipio' },
  { value: 'departamental', label: 'Todo el departamento' },
  { value: 'regional', label: 'Varios departamentos / región' },
  { value: 'nacional', label: 'Cobertura nacional' },
];

const MADUREZ_TEC_OPCIONES = [
  { value: 'basica', label: 'Básica: ofimática y correo' },
  { value: 'intermedia', label: 'Intermedia: software de gestión / nube' },
  { value: 'avanzada', label: 'Avanzada: automatizamos procesos y analizamos datos' },
  { value: 'producto_digital', label: 'Desarrollamos producto o plataforma digital propia' },
];

const RANGO_VENTAS_OPCIONES = [
  { value: 'menos_100m', label: 'Menos de $100 millones COP/año' },
  { value: '100m_500m', label: 'Entre $100 y $500 millones COP/año' },
  { value: '500m_2000m', label: 'Entre $500 y $2.000 millones COP/año' },
  { value: 'mas_2000m', label: 'Más de $2.000 millones COP/año' },
];

const CRECIMIENTO_OPCIONES = [
  { value: 'decrecio', label: 'Decrecieron' },
  { value: 'estable', label: 'Se mantuvieron estables' },
  { value: 'crecio', label: 'Crecieron' },
  { value: 'crecio_fuerte', label: 'Crecieron más del 30%' },
];

const ENDEUDAMIENTO_OPCIONES = [
  { value: 'bajo', label: 'Bajo: menos del 30% de los activos' },
  { value: 'medio', label: 'Medio: entre 30% y 60%' },
  { value: 'alto', label: 'Alto: más del 60%' },
  { value: 'no_sabe', label: 'No tengo el dato' },
];

export const QUESTIONS = [
  // ==================================================================
  // ETAPA 1 · ¿QUIÉNES SON?
  // ==================================================================
  {
    id: 'nombre',
    empresaField: 'nombre',
    etapa: 1,
    bloque: 'Quiénes son',
    dimension: null,
    type: 'text',
    required: true,
    prompt: 'Soy IDEAPRO Intelligence AI, consultor estratégico de valor público 👋. Voy a hacerte pocas preguntas, todas con un propósito, y al final te entrego un diagnóstico completo. Empecemos: ¿cuál es el nombre de la organización?',
  },
  {
    // Se pregunta SOLO si la razón social no permitió deducir la
    // naturaleza jurídica (ver inference.js). A la Fundación X no se le
    // pregunta si es una fundación.
    id: 'tipo_organizacion',
    empresaField: 'tipo_organizacion',
    etapa: 1,
    bloque: 'Quiénes son',
    dimension: null,
    type: 'select',
    required: true,
    options: TIPOS_ORGANIZACION,
    // La condición mira si el dato fue DEDUCIDO, no si está respondido.
    // Si mirara `!r.tipo_organizacion`, responderla la sacaría de la
    // lista visible, el índice de paso se correría y la organización se
    // saltaría la pregunta siguiente sin que nadie lo notara.
    showIf: (r) => !r.tipo_organizacion || !!r._inferidos?.tipo_organizacion,
    prompt: 'De qué naturaleza es la organización. Esto define el marco jurídico con el que puede relacionarse con el Estado.',
  },
  {
    id: 'identificacion',
    etapa: 1,
    bloque: 'Quiénes son',
    dimension: 'legal',
    type: 'form',
    required: true,
    prompt: '¿Con quién tengo el gusto de hablar? Necesito tu nombre, tu cargo (para saber si hay facultades de representación o dependemos de un tercero para firmar) y un correo donde enviarte el reporte.',
    campos: [
      { id: 'nombre_contacto', empresaField: 'nombre_contacto', type: 'text', label: 'Nombre de contacto', required: true, placeholder: 'Nombre y apellido' },
      { id: 'cargo_contacto', empresaField: 'cargo_contacto', type: 'text', label: 'Cargo', required: true, placeholder: 'Ej: representante legal, directora de proyectos' },
      { id: 'correo_contacto', empresaField: 'correo_contacto', type: 'text', label: 'Correo institucional', required: true, placeholder: 'nombre@organizacion.com' },
    ],
  },
  {
    id: 'anios_operacion',
    empresaField: 'anios_operacion',
    etapa: 1,
    bloque: 'Quiénes son',
    dimension: 'experiencia',
    type: 'number',
    required: true,
    // Va sola y temprano a propósito: es el filtro duro de elegibilidad.
    // Si no lo pasa, no tiene sentido gastarle diez preguntas más.
    prompt: '¿Cuánto tiempo llevan operando formalmente?',
  },
  {
    id: 'contexto_operacion',
    etapa: 1,
    bloque: 'Quiénes son',
    dimension: 'comercial',
    type: 'form',
    required: true,
    prompt: '¿Desde dónde operan? Con la ciudad y el departamento puedo mapear las entidades territoriales que podrían requerir sus servicios.',
    campos: [
      { id: 'ubicacion_ciudad', empresaField: 'ubicacion_ciudad', type: 'text', label: 'Ciudad', required: true, placeholder: 'Ej: Bucaramanga' },
      { id: 'ubicacion_departamento', empresaField: 'ubicacion_departamento', type: 'text', label: 'Departamento', required: true, placeholder: 'Ej: Santander' },
      { id: 'sitio_web', empresaField: 'sitio_web', type: 'text', label: 'Sitio web o perfil institucional', required: false, placeholder: 'Si no tienen, escribe "no"' },
    ],
  },

  // ==================================================================
  // ETAPA 2 · ¿QUÉ HACEN?
  // ==================================================================
  {
    id: 'tipo_bien_servicio',
    empresaField: 'tipo_bien_servicio',
    etapa: 2,
    bloque: 'Qué hacen',
    dimension: 'oferta',
    type: 'textarea',
    required: true,
    prompt: 'Cuéntame a qué se dedican principalmente: ¿qué producto o servicio ofrecen?',
  },

  // ==================================================================
  // ETAPA 3 · ¿QUÉ PROBLEMA RESUELVEN?
  // ==================================================================
  {
    id: 'propuesta_valor',
    etapa: 3,
    bloque: 'Qué problema resuelven',
    dimension: 'oferta',
    type: 'form',
    required: true,
    prompt: 'Ahora lo importante: más allá del servicio, ¿qué problema concreto le resuelven a su cliente? Piensa en el dolor que desaparece cuando ustedes entran. Y, si aplica, qué los diferencia de quien ofrece algo parecido.',
    campos: [
      { id: 'problema_que_resuelve', type: 'textarea', label: 'Problema que resuelven', required: true, placeholder: 'El dolor concreto que desaparece' },
      { id: 'diferenciador', type: 'textarea', label: 'Qué los diferencia', required: false, placeholder: 'Opcional, pero pesa en la propuesta de valor' },
    ],
  },
  {
    // Se pregunta SOLO si la descripción de la oferta no permitió
    // clasificar el sector con evidencia suficiente (ver inference.js).
    id: 'sector_texto',
    empresaField: 'sector_texto',
    etapa: 3,
    bloque: 'Qué problema resuelven',
    dimension: 'oferta',
    type: 'select',
    required: true,
    optionsSource: 'sectores',
    // Igual que arriba: depende de la deducción, no de la respuesta.
    showIf: (r) => !r.sector_texto || !!r._inferidos?.sector_texto,
    prompt: 'Con lo que me cuentas podría ubicarlos en más de un sector y eso cambia el peso de la evaluación. ¿En cuál se reconocen principalmente?',
  },

  // ==================================================================
  // ETAPA 4 · ¿TIENEN CAPACIDAD PARA EJECUTARLO?
  // ==================================================================
  {
    id: 'capacidad_ejecucion',
    etapa: 4,
    bloque: 'Capacidad para ejecutar',
    dimension: 'operativa',
    type: 'multi',
    required: false, // no marcar nada es una respuesta legítima y diciente
    prompt: 'Vamos a validar si hoy podrían ejecutar. Marca todo lo que sea cierto en su organización; lo que dejes sin marcar también me dice algo.',
    options: [
      { value: 'ventas_registradas', label: 'Tenemos ventas o ingresos registrados contablemente en el último año fiscal', dimension: 'financiera' },
      { value: 'capital_trabajo', label: 'Contamos con capital de trabajo propio para arrancar antes del primer desembolso', dimension: 'financiera' },
      { value: 'experiencia_proyectos', label: 'Hemos ejecutado proyectos con alcance, cronograma y entregables definidos', dimension: 'experiencia' },
      { value: 'capacidad_operativa', label: 'Podríamos ejecutar un contrato hoy sin frenar nuestra operación actual', dimension: 'operativa' },
      { value: 'capacidad_escalar', label: 'Podríamos ejecutar dos o más contratos simultáneos sin perder calidad', dimension: 'operativa' },
      { value: 'procesos_documentados', label: 'Nuestra metodología y nuestros procesos están documentados', dimension: 'operativa' },
    ],
  },
  {
    id: 'equipo_cobertura',
    etapa: 4,
    bloque: 'Capacidad para ejecutar',
    dimension: 'operativa',
    type: 'form',
    required: true,
    prompt: 'Dimensionemos el músculo: tamaño del equipo, hasta dónde llega hoy su operación real y qué tan digital es la casa por dentro.',
    campos: [
      { id: 'tamanio_equipo', empresaField: 'tamanio_equipo', type: 'number', label: 'Personas en el equipo', required: true, placeholder: 'Ej: 12' },
      { id: 'cobertura_territorial', type: 'select', label: 'Cobertura real de operación', required: true, options: COBERTURA_OPCIONES },
      { id: 'madurez_tecnologica', type: 'select', label: 'Madurez tecnológica interna', required: true, options: MADUREZ_TEC_OPCIONES },
    ],
  },
  {
    id: 'alistamiento_juridico',
    etapa: 4,
    bloque: 'Capacidad para ejecutar',
    dimension: 'legal',
    type: 'multi',
    required: false,
    prompt: 'El frente jurídico y documental es donde más organizaciones se caen antes de competir. Marca lo que ya tengan vigente y en orden.',
    options: [
      { value: 'camara_comercio', label: 'Registro en Cámara de Comercio (o el equivalente según su naturaleza) renovado y vigente' },
      { value: 'tiene_rup', label: 'RUP inscrito y actualizado', empresaField: 'tiene_rup' },
      { value: 'certificaciones', label: 'Certificaciones de calidad (ISO u otras) o habilitaciones sectoriales vigentes', empresaField: 'certificaciones', dimension: 'experiencia' },
      { value: 'gestion_documental', label: 'Expediente documental listo para acreditar (financieros, certificaciones de experiencia, actas, seguridad social)' },
      { value: 'conoce_pliegos', label: 'Leemos e interpretamos pliegos y requisitos habilitantes con comodidad' },
    ],
  },
  {
    id: 'perfil_financiero',
    etapa: 4,
    bloque: 'Capacidad para ejecutar',
    dimension: 'financiera',
    type: 'form',
    required: true,
    prompt: 'El Estado paga contra entrega y suele demorarse, así que el frente financiero define cuánto contrato pueden aguantar.',
    campos: [
      { id: 'rango_ventas', empresaField: 'rango_ventas', type: 'select', label: 'Ingresos anuales', required: true, options: RANGO_VENTAS_OPCIONES },
      { id: 'crecimiento_ventas', type: 'select', label: 'Comportamiento frente al año anterior', required: true, options: CRECIMIENTO_OPCIONES },
      { id: 'endeudamiento', type: 'select', label: 'Nivel de endeudamiento', required: true, options: ENDEUDAMIENTO_OPCIONES },
      { id: 'flujo_caja', type: 'boolean', label: '¿Podrían sostener la operación 2 o 3 meses sin recibir el pago de un contrato?', required: true },
      { id: 'capacidad_garantias', type: 'boolean', label: '¿Han gestionado antes pólizas o garantías de cumplimiento?', required: true },
    ],
  },

  // ==================================================================
  // ETAPA 5 · ¿TIENEN EXPERIENCIA CON EL SECTOR PÚBLICO?
  // ==================================================================
  {
    id: 'experiencia_publica',
    etapa: 5,
    bloque: 'Experiencia con el sector público',
    dimension: 'experiencia',
    type: 'form',
    required: true,
    prompt: 'Hablemos de trayectoria. ¿Han trabajado con entidades públicas, y qué pueden acreditar con evidencia verificable?',
    campos: [
      { id: 'experiencia_previa_contratos', empresaField: 'experiencia_previa_contratos', type: 'boolean', label: '¿Han ejecutado contratos o convenios con entidades públicas?', required: true },
      {
        id: 'num_contratos_previos',
        empresaField: 'num_contratos_previos',
        type: 'number',
        label: '¿Cuántos, aproximadamente?',
        required: false,
        placeholder: 'Ej: 4',
        // Condición dentro del propio formulario: se evalúa contra los
        // valores que la persona está diligenciando, no contra la sesión.
        // Es declarativa (y no una función) porque viaja serializada al
        // frontend, que es quien muestra u oculta el campo en vivo.
        mostrarSi: { campo: 'experiencia_previa_contratos', igual: true },
      },
      { id: 'casos_exito', type: 'number', label: 'Casos de éxito documentables (actas, certificaciones, resultados medibles)', required: true, placeholder: 'Ej: 3' },
    ],
  },
  {
    id: 'ecosistema_publico',
    etapa: 5,
    bloque: 'Experiencia con el sector público',
    dimension: 'comercial',
    type: 'multi',
    required: false,
    prompt: 'Y sobre el terreno de juego: marca lo que hoy sea cierto en su relación con el ecosistema público.',
    options: [
      { value: 'conoce_secop', label: 'Conocemos y monitoreamos activamente SECOP II / Colombia Compra Eficiente' },
      { value: 'conoce_planes_desarrollo', label: 'Revisamos planes de desarrollo territoriales para ubicar dónde está presupuestada la necesidad que resolvemos' },
      { value: 'conoce_mga', label: 'Sabemos cómo se formula un proyecto de inversión pública (MGA, bancos de proyectos, regalías)' },
      { value: 'equipo_comercial_dedicado', label: 'Tenemos a alguien dedicado a identificar y gestionar oportunidades públicas' },
    ],
  },

  // ==================================================================
  // ETAPA 6 · ¿QUÉ LES FALTA PARA CRECER?
  // ==================================================================
  {
    id: 'cierre',
    etapa: 6,
    bloque: 'Qué les falta para crecer',
    dimension: null,
    type: 'form',
    required: true,
    prompt: 'Última pregunta del núcleo, y es la que más me sirve: ¿cuál es el principal reto que tienen hoy, y qué esperan lograr acercándose a IDEAPRO?',
    campos: [
      { id: 'reto_actual', type: 'textarea', label: 'Principal reto actual', required: true, placeholder: 'Lo que hoy les impide crecer' },
      { id: 'objetivo_6_meses', empresaField: 'objetivo_6_meses', type: 'textarea', label: 'Qué esperan lograr en los próximos 6 meses', required: true, placeholder: 'Su objetivo frente al mercado público' },
    ],
  },

  // ==================================================================
  // ETAPA 7 · PROFUNDIZACIÓN ADAPTATIVA (máximo 3)
  // ------------------------------------------------------------------
  // Ninguna de estas preguntas se hace "por completar el formulario":
  // cada una existe porque un detector de sufficiency.js encontró una
  // inconsistencia, una brecha de información, un riesgo o una
  // oportunidad. Si no hay señales, esta etapa entera no ocurre y el
  // agente pasa directo al diagnóstico.
  // ==================================================================
  {
    id: 'figura_contratacion',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'legal',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'figura_contratacion'),
    prompt: 'Hay algo que quiero entender bien: me dices que ya ejecutaron contratos o convenios públicos, pero sin RUP ni expediente documental organizado. ¿Bajo qué figura contrataron (convenio de asociación, régimen especial, unión temporal, subcontratación)?',
  },
  {
    id: 'problema_detallado',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'oferta',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'problema_detallado'),
    prompt: 'Necesito aterrizar mejor el problema que resuelven, porque de ahí sale la entidad que debería contratarlos. Cuéntame un caso concreto: quién tenía el problema, en qué se notaba y qué cambió después de ustedes.',
  },
  {
    id: 'tec_dependencia_objetivo',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'comercial',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'tec_dependencia_objetivo'),
    prompt: 'Su perfil es claramente tecnológico, así que afinemos el comprador: ¿qué dependencia dentro de una entidad pública se beneficiaría más de su solución (planeación, TIC, gestión documental, atención al ciudadano, contratación)?',
  },
  {
    id: 'for_resultados',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'experiencia',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'for_resultados'),
    prompt: 'En formación, lo que abre puertas en el Estado son los resultados verificables. ¿Qué pueden acreditar: personas formadas, certificación emitida, cambios medibles en la entidad?',
  },
  {
    id: 'con_resultados',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'experiencia',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'con_resultados'),
    prompt: 'Un consultor se mide por lo que la entidad pudo hacer después de que él se fue. ¿Qué resultado concreto dejaron en la última organización que acompañaron?',
  },
  {
    id: 'fun_territorios',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'operativa',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'fun_territorios'),
    prompt: 'Para cruzar su operación con los planes de desarrollo necesito el territorio concreto: ¿en qué municipios trabajan hoy y a cuánta población atienden al año?',
  },
  {
    id: 'uni_lineas_investigacion',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'oferta',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'uni_lineas_investigacion'),
    prompt: '¿Cuáles son sus líneas de investigación o extensión más fuertes, y cuáles cuentan con grupos reconocidos por MinCiencias?',
  },
  {
    id: 'financiacion_ejecucion',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'financiera',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'financiacion_ejecucion'),
    prompt: 'Detecto un riesgo de liquidez y prefiero nombrarlo: si mañana ganaran un contrato que paga contra entrega a 60 o 90 días, ¿con qué lo financiarían mientras llega el desembolso?',
  },
  {
    id: 'entidades_objetivo',
    etapa: 7,
    bloque: 'Profundización',
    dimension: 'comercial',
    type: 'textarea',
    required: false,
    showIf: (r) => seProfundizaEn(r, 'entidades_objetivo'),
    prompt: 'No alcancé a identificar a qué entidades apuntan. ¿Tienen alguna en la mira (alcaldías, gobernaciones, hospitales, universidades públicas, ministerios)? Si aún no, dilo con esa franqueza y yo te propongo el mapa.',
  },
];

// ------------------------------------------------------------ helpers

/** Campos que una pregunta compuesta aporta a `respuestas`. */
export function llavesDePregunta(pregunta) {
  if (!pregunta) return [];
  if (pregunta.type === 'form') return pregunta.campos.map((c) => c.id);
  if (pregunta.type === 'multi') return pregunta.options.map((o) => o.value);
  return [pregunta.id];
}

/** Sub-definiciones (campo de form / opción de multi) por su llave. */
export function definicionDeLlave(pregunta, llave) {
  if (!pregunta) return null;
  if (pregunta.type === 'form') return pregunta.campos.find((c) => c.id === llave) || null;
  if (pregunta.type === 'multi') return pregunta.options.find((o) => o.value === llave) || null;
  return pregunta.id === llave ? pregunta : null;
}

/**
 * Traduce el valor recibido de una pregunta a las llaves planas que
 * consumen los motores deterministas. Un checklist de cinco opciones
 * entra como un array y sale como cinco booleanos: scoring.js sigue
 * leyendo exactamente los mismos campos que antes.
 */
export function derivarRespuestas(pregunta, valor) {
  if (!pregunta) return {};
  if (pregunta.type === 'multi') {
    const marcadas = Array.isArray(valor) ? valor : [];
    const derivadas = { [pregunta.id]: marcadas };
    for (const opcion of pregunta.options) {
      derivadas[opcion.value] = marcadas.includes(opcion.value);
    }
    return derivadas;
  }
  if (pregunta.type === 'form') {
    const valores = valor && typeof valor === 'object' ? valor : {};
    const derivadas = { [pregunta.id]: valores };
    for (const campo of pregunta.campos) {
      if (valores[campo.id] !== undefined) derivadas[campo.id] = valores[campo.id];
    }
    return derivadas;
  }
  return { [pregunta.id]: valor };
}

/** Pares empresaField -> valor que una respuesta debe sincronizar. */
export function camposEmpresaDe(pregunta, derivadas) {
  const payload = {};
  if (!pregunta) return payload;
  if (pregunta.empresaField) payload[pregunta.empresaField] = derivadas[pregunta.id];
  for (const llave of llavesDePregunta(pregunta)) {
    const definicion = definicionDeLlave(pregunta, llave);
    if (definicion?.empresaField && derivadas[llave] !== undefined) {
      payload[definicion.empresaField] = derivadas[llave];
    }
  }
  return payload;
}

/** Todos los empresaField declarados en el flujo (anti mass-assignment). */
export function todosLosCamposEmpresa() {
  const campos = new Set();
  for (const pregunta of QUESTIONS) {
    if (pregunta.empresaField) campos.add(pregunta.empresaField);
    for (const llave of llavesDePregunta(pregunta)) {
      const definicion = definicionDeLlave(pregunta, llave);
      if (definicion?.empresaField) campos.add(definicion.empresaField);
    }
  }
  return campos;
}

// Memoria inteligente · las llaves que están en `respuestas._memoria`
// ya fueron respondidas en un diagnóstico anterior de la misma
// organización: el consultor NO vuelve a preguntarlas, pero el dato
// sigue disponible para todos los motores porque el valor sí está en
// `respuestas`. En una pregunta compuesta se ocultan los campos
// heredados; si TODOS lo están, desaparece la pregunta entera.
export function camposVisibles(pregunta, respuestas = {}) {
  const heredadas = new Set(respuestas?._memoria || []);
  if (pregunta.type === 'form') return pregunta.campos.filter((c) => !heredadas.has(c.id));
  if (pregunta.type === 'multi') return pregunta.options.filter((o) => !heredadas.has(o.value));
  return [];
}

export function getVisibleQuestions(respuestas = {}) {
  const heredadas = new Set(respuestas?._memoria || []);
  return QUESTIONS
    .filter((q) => !heredadas.has(q.id))
    .filter((q) => {
      if (q.type !== 'form' && q.type !== 'multi') return true;
      return camposVisibles(q, respuestas).length > 0;
    })
    .filter((q) => (q.showIf ? q.showIf(respuestas) : true));
}

/** Preguntas que existen en el protocolo, respondidas o heredadas. */
export function getQuestionById(id) {
  return QUESTIONS.find((q) => q.id === id) || null;
}

export function getStepByIndex(index, respuestas = {}) {
  const visible = getVisibleQuestions(respuestas);
  return visible[index] || null;
}

export function totalSteps(respuestas = {}) {
  return getVisibleQuestions(respuestas).length;
}

/** Preguntas del núcleo (todo lo que no es profundización adaptativa). */
export const PREGUNTAS_NUCLEO = QUESTIONS.filter((q) => q.etapa !== 7);

// Devuelve true cuando la pregunta abre un bloque nuevo respecto de la
// anterior: el frontend lo usa para anunciar la etapa en el chat y que
// la conversación se sienta guiada por un consultor y no por un
// formulario plano.
export function esInicioDeBloque(pregunta, respuestas = {}) {
  if (!pregunta) return false;
  const visible = getVisibleQuestions(respuestas);
  const indice = visible.findIndex((q) => q.id === pregunta.id);
  if (indice <= 0) return true;
  return visible[indice - 1].bloque !== pregunta.bloque;
}
