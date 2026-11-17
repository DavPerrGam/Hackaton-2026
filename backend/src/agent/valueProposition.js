// =====================================================================
// ETAPA 6 · Perfilamiento de servicios como valor publico
// ---------------------------------------------------------------------
// El protocolo es explicito: no basta con registrar el servicio.
// Hay que reconstruir la propuesta de valor recorriendo la cadena
//
//   SERVICIO -> CAPACIDAD -> PROBLEMA QUE RESUELVE -> NECESIDAD
//   PUBLICA -> IMPACTO ESPERADO -> POSIBLE COMPRADOR PUBLICO
//
// Ejemplo del reto:
//   "Software administrativo" -> Automatizacion de procesos -> Reduce
//   tiempos operativos -> Modernizacion institucional -> Mayor
//   eficiencia administrativa -> Alcaldias, gobernaciones, ESE,
//   universidades publicas.
//
// La traduccion se hace sobre la CLASIFICACION ya calculada (etapa 3),
// no sobre el texto crudo: asi la cadena es coherente con el resto del
// diagnostico y auditable. Cuando la organizacion pertenece a varias
// categorias se construye una cadena por cada una de las principales,
// porque una misma capacidad puede atender necesidades publicas
// distintas (y por tanto compradores distintos).
// =====================================================================

// Traduccion por categoria: de lo que la organizacion vende a lo que
// el Estado compra. Los compradores se declaran como TIPOS de entidad;
// entityMap.js los aterriza al territorio concreto.
const TRADUCCIONES = {
  tecnologia: {
    capacidad: 'Desarrollo y soporte de soluciones tecnológicas',
    necesidad: 'Modernización institucional y gobierno digital',
    impacto: 'Mayor eficiencia administrativa y trazabilidad de la gestión',
    compradores: ['alcaldias', 'gobernaciones', 'ese_hospitales', 'universidades_publicas', 'institutos_descentralizados'],
    politica: 'Política de Gobierno Digital (MinTIC) y Plan Nacional de Infraestructura Digital',
  },
  govtech: {
    capacidad: 'Digitalización de trámites y servicios ciudadanos',
    necesidad: 'Racionalización de trámites y mejora de la relación Estado-ciudadano',
    impacto: 'Reducción de tiempos de respuesta y aumento de la satisfacción ciudadana',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'agencias_nacionales', 'institutos_descentralizados'],
    politica: 'Estrategia de racionalización de trámites (DAFP) y Gobierno Digital',
  },
  civictech: {
    capacidad: 'Habilitación de participación ciudadana y control social',
    necesidad: 'Transparencia, participación y lucha contra la corrupción',
    impacto: 'Mayor confianza institucional y decisiones públicas legitimadas',
    compradores: ['alcaldias', 'gobernaciones', 'agencias_nacionales', 'cooperacion_internacional'],
    politica: 'Política de Transparencia e Integridad Pública y Ley de Participación Ciudadana',
  },
  transformacion_digital: {
    capacidad: 'Automatización y rediseño de procesos institucionales',
    necesidad: 'Modernización de la gestión y eficiencia del gasto público',
    impacto: 'Reducción de tiempos operativos y liberación de capacidad del talento humano',
    compradores: ['alcaldias', 'gobernaciones', 'ese_hospitales', 'empresas_servicios_publicos', 'universidades_publicas'],
    politica: 'Modelo Integrado de Planeación y Gestión (MIPG), dimensión de gestión con valores para resultados',
  },
  educacion: {
    capacidad: 'Diseño y operación de procesos educativos',
    necesidad: 'Calidad y cobertura educativa en el territorio',
    impacto: 'Mejora en indicadores de permanencia, aprendizaje y pertinencia',
    compradores: ['secretarias_educacion', 'instituciones_educativas', 'ministerios', 'gobernaciones'],
    politica: 'Plan Nacional Decenal de Educación y planes sectoriales territoriales',
  },
  formacion: {
    capacidad: 'Formación y desarrollo de capacidades institucionales',
    necesidad: 'Fortalecimiento del talento humano público y del tejido empresarial',
    impacto: 'Servidores y organizaciones con competencias verificables para ejecutar',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'camaras_comercio', 'institutos_descentralizados'],
    politica: 'Plan Institucional de Capacitación (PIC) y política de empleo público',
  },
  ingenieria: {
    capacidad: 'Diseño, cálculo e interventoría técnica',
    necesidad: 'Infraestructura segura, viable y técnicamente soportada',
    impacto: 'Obras ejecutadas dentro de estándares, plazos y presupuesto',
    compradores: ['alcaldias', 'gobernaciones', 'empresas_servicios_publicos', 'agencias_nacionales'],
    politica: 'Planes viales, planes maestros de servicios públicos y proyectos de regalías',
  },
  consultoria: {
    capacidad: 'Asesoría técnica especializada y estructuración de soluciones',
    necesidad: 'Capacidad institucional para decidir y ejecutar con evidencia',
    impacto: 'Decisiones públicas mejor fundamentadas y proyectos ejecutables',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'agencias_nacionales', 'corporaciones_autonomas'],
    politica: 'MIPG y ciclo de la inversión pública (DNP)',
  },
  planeacion: {
    capacidad: 'Formulación y estructuración de instrumentos de planeación',
    necesidad: 'Planes de desarrollo y proyectos de inversión bien formulados',
    impacto: 'Mayor ejecución presupuestal y acceso a fuentes como el SGR',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'agencias_nacionales'],
    politica: 'Ley Orgánica del Plan de Desarrollo, MGA y Sistema General de Regalías',
  },
  infraestructura: {
    capacidad: 'Ejecución de obra civil y mantenimiento de infraestructura',
    necesidad: 'Cierre de brechas de infraestructura y conectividad territorial',
    impacto: 'Población con acceso efectivo a servicios e infraestructura funcional',
    compradores: ['alcaldias', 'gobernaciones', 'empresas_servicios_publicos', 'agencias_nacionales'],
    politica: 'Planes de desarrollo territoriales y proyectos financiados con regalías',
  },
  salud: {
    capacidad: 'Prestación y soporte de servicios de salud',
    necesidad: 'Acceso, oportunidad y calidad en la atención en salud',
    impacto: 'Mejora en indicadores de morbimortalidad y oportunidad de atención',
    compradores: ['ese_hospitales', 'secretarias_salud', 'ministerios', 'gobernaciones'],
    politica: 'Plan Decenal de Salud Pública y planes territoriales de salud',
  },
  sostenibilidad: {
    capacidad: 'Gestión de sostenibilidad y economía circular',
    necesidad: 'Cumplimiento de compromisos ambientales y de los ODS',
    impacto: 'Reducción de impacto ambiental medible y verificable',
    compradores: ['corporaciones_autonomas', 'alcaldias', 'gobernaciones', 'cooperacion_internacional'],
    politica: 'Política Nacional de Economía Circular y compromisos NDC',
  },
  medio_ambiente: {
    capacidad: 'Gestión y conservación ambiental',
    necesidad: 'Protección de ecosistemas y gestión del recurso hídrico',
    impacto: 'Ecosistemas conservados y riesgo ambiental gestionado',
    compradores: ['corporaciones_autonomas', 'alcaldias', 'gobernaciones', 'ministerios'],
    politica: 'Planes de Ordenación y Manejo de Cuencas (POMCA) y planes de acción de las CAR',
  },
  desarrollo_economico: {
    capacidad: 'Fortalecimiento del tejido productivo',
    necesidad: 'Generación de empleo, productividad y competitividad territorial',
    impacto: 'Unidades productivas fortalecidas y empleo formal generado',
    compradores: ['alcaldias', 'gobernaciones', 'camaras_comercio', 'ministerios', 'agencias_nacionales'],
    politica: 'Política de Desarrollo Productivo y Comisiones Regionales de Competitividad',
  },
  emprendimiento: {
    capacidad: 'Incubación y aceleración de emprendimientos',
    necesidad: 'Creación y escalamiento de nuevas unidades productivas',
    impacto: 'Emprendimientos sostenibles con ingresos y empleo verificables',
    compradores: ['alcaldias', 'gobernaciones', 'camaras_comercio', 'agencias_nacionales', 'universidades_publicas'],
    politica: 'Ley de Emprendimiento (Ley 2069 de 2020) y programas de iNNpulsa',
  },
  investigacion: {
    capacidad: 'Investigación aplicada y generación de conocimiento',
    necesidad: 'Evidencia científica para la decisión pública y la innovación',
    impacto: 'Decisiones basadas en evidencia y capacidades de CTeI instaladas',
    compradores: ['universidades_publicas', 'ministerios', 'agencias_nacionales', 'gobernaciones'],
    politica: 'Política de Ciencia, Tecnología e Innovación y fondo de CTeI del SGR',
  },
  cooperacion: {
    capacidad: 'Gestión de cooperación y financiación internacional',
    necesidad: 'Movilización de recursos no reembolsables para el territorio',
    impacto: 'Proyectos territoriales financiados con recursos adicionales',
    compradores: ['cooperacion_internacional', 'alcaldias', 'gobernaciones', 'ministerios'],
    politica: 'Estrategia Nacional de Cooperación Internacional (APC Colombia)',
  },
  innovacion: {
    capacidad: 'Diseño y facilitación de procesos de innovación pública',
    necesidad: 'Soluciones nuevas a problemas públicos persistentes',
    impacto: 'Soluciones validadas con la ciudadanía y escalables',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'agencias_nacionales', 'universidades_publicas'],
    politica: 'Agenda de innovación pública y laboratorios de gobierno',
  },
  desarrollo_social: {
    capacidad: 'Implementación de programas sociales en territorio',
    necesidad: 'Atención a población vulnerable y cierre de brechas sociales',
    impacto: 'Población atendida con mejora verificable en sus condiciones',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'agencias_nacionales', 'cooperacion_internacional'],
    politica: 'Política Social del Plan Nacional de Desarrollo y planes territoriales',
  },
  agricultura: {
    capacidad: 'Producción, transformación y asistencia técnica agropecuaria',
    necesidad: 'Seguridad alimentaria y desarrollo rural con enfoque territorial',
    impacto: 'Productores con mayor productividad e ingresos',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'agencias_nacionales'],
    politica: 'Planes Integrales de Desarrollo Agropecuario y Rural (PIDAR) y PDET',
  },
  turismo: {
    capacidad: 'Desarrollo y promoción de productos turísticos',
    necesidad: 'Diversificación económica y posicionamiento del territorio',
    impacto: 'Aumento de visitantes, ingresos y empleo local',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'camaras_comercio'],
    politica: 'Plan Sectorial de Turismo y planes de desarrollo turístico departamentales',
  },
  logistica: {
    capacidad: 'Operación logística y de abastecimiento',
    necesidad: 'Suministro oportuno y eficiente de bienes públicos',
    impacto: 'Entrega oportuna y reducción del costo de abastecimiento',
    compradores: ['alcaldias', 'gobernaciones', 'ese_hospitales', 'institutos_descentralizados'],
    politica: 'Planes anuales de adquisiciones y acuerdos marco de Colombia Compra Eficiente',
  },
  energia: {
    capacidad: 'Soluciones energéticas y de eficiencia',
    necesidad: 'Cobertura energética y reducción del gasto público en energía',
    impacto: 'Ahorro en la factura pública y cobertura en zonas no interconectadas',
    compradores: ['alcaldias', 'gobernaciones', 'empresas_servicios_publicos', 'ministerios'],
    politica: 'Plan Energético Nacional y programas de energización rural (IPSE)',
  },
  cultura: {
    capacidad: 'Gestión cultural y del patrimonio',
    necesidad: 'Acceso a la oferta cultural y protección del patrimonio',
    impacto: 'Población con acceso cultural y patrimonio conservado',
    compradores: ['alcaldias', 'gobernaciones', 'ministerios', 'institutos_descentralizados'],
    politica: 'Plan Nacional de Cultura y planes departamentales de cultura',
  },
};

const TRADUCCION_GENERICA = {
  capacidad: 'Prestación especializada del servicio declarado',
  necesidad: 'Cumplimiento de metas del plan de desarrollo territorial',
  impacto: 'Cumplimiento de la meta pública asociada con evidencia de ejecución',
  compradores: ['alcaldias', 'gobernaciones', 'institutos_descentralizados'],
  politica: 'Plan de desarrollo territorial vigente',
};

/**
 * Construye la cadena de valor público de la organización.
 * @param {object} respuestas respuestas planas de la sesión
 * @param {object} clasificacion salida de clasificarOrganizacion()
 * @returns {{cadenas: Array, resumen: string, compradores: string[]}}
 */
export function perfilarOferta(respuestas = {}, clasificacion = { categorias: [] }) {
  const servicio = String(respuestas.tipo_bien_servicio || '').trim() || 'Servicio no declarado';
  const problemaDeclarado = String(respuestas.problema_que_resuelve || '').trim();
  const diferenciador = String(respuestas.diferenciador || '').trim();

  const categorias = (clasificacion.categorias || []).slice(0, 3);
  const base = categorias.length > 0
    ? categorias
    : [{ id: 'generica', nombre: 'Oferta general', afinidad: 0 }];

  const cadenas = base.map((categoria) => {
    const traduccion = TRADUCCIONES[categoria.id] || TRADUCCION_GENERICA;
    return {
      categoria: categoria.nombre,
      afinidad: categoria.afinidad,
      servicio,
      capacidad: traduccion.capacidad,
      problema: problemaDeclarado || 'La organización aún no formuló con precisión el problema que resuelve.',
      necesidad_publica: traduccion.necesidad,
      impacto_esperado: traduccion.impacto,
      compradores_publicos: traduccion.compradores,
      politica_asociada: traduccion.politica,
    };
  });

  const compradores = [...new Set(cadenas.flatMap((c) => c.compradores_publicos))];

  return {
    cadenas,
    compradores,
    diferenciador: diferenciador || null,
    // Advertencia explícita para el consultor: sin problema formulado
    // la propuesta de valor no es traducible a lenguaje de compra
    // pública, por más buena que sea la capacidad técnica.
    alerta: problemaDeclarado.length < 10
      ? 'La organización no logró formular el problema que resuelve. Sin esa formulación no es posible traducir su oferta a una necesidad pública contratable.'
      : null,
    resumen: cadenas.length > 0
      ? `"${servicio}" se traduce como ${cadenas[0].capacidad.toLowerCase()}, que atiende la necesidad pública de ${cadenas[0].necesidad_publica.toLowerCase()} y genera ${cadenas[0].impacto_esperado.toLowerCase()}.`
      : '',
  };
}

export const _internal = { TRADUCCIONES, TRADUCCION_GENERICA };
