// =====================================================================
// ETAPA 2 · Validacion obligatoria de elegibilidad
// ---------------------------------------------------------------------
// El protocolo Nexus exige validar SEIS condiciones antes de emitir
// cualquier recomendacion. La diferencia frente a la version anterior
// del agente es que aqui NO se corta la conversacion por cada
// incumplimiento: solo la antiguedad menor a un anio es descalificante
// (una organizacion sin un anio de operacion no puede acreditar
// experiencia ni estados financieros comparables). El resto de
// incumplimientos se marcan como RIESGO DE ELEGIBILIDAD, se explican y
// se convierten en acciones concretas del plan 30/60/90/180.
//
// Salida:
//   estado:  'elegible' | 'riesgo' | 'no_elegible'
//   criterios: [{ id, nombre, cumple, evaluado, razon }]
//   riesgos:  subconjunto de criterios incumplidos, con su razon
// =====================================================================

const CRITERIOS = [
  {
    id: 'antiguedad',
    nombre: 'Más de un año de operación',
    descalificante: true,
    evaluar: (r) => {
      const anios = Number(r.anios_operacion);
      if (!Number.isFinite(anios)) return { cumple: null };
      return {
        cumple: anios >= 1,
        razon: anios >= 1
          ? `La organización acredita ${anios} año(s) de operación formal.`
          : 'Las entidades públicas exigen antigüedad verificable; con menos de un año no es posible acreditar experiencia ni estados financieros comparables.',
      };
    },
  },
  {
    id: 'ventas',
    nombre: 'Ventas registradas',
    evaluar: (r) => ({
      cumple: r.ventas_registradas === true,
      razon: r.ventas_registradas === true
        ? 'Existen ingresos registrados contablemente en el último año fiscal.'
        : 'Sin ingresos registrados no es posible acreditar capacidad financiera ni construir los indicadores habilitantes que exige el pliego.',
    }),
  },
  {
    id: 'capital_trabajo',
    nombre: 'Capital de trabajo',
    evaluar: (r) => ({
      cumple: r.capital_trabajo === true,
      razon: r.capital_trabajo === true
        ? 'La organización puede arrancar la ejecución con recursos propios.'
        : 'El Estado paga contra entrega: sin capital de trabajo el riesgo de incumplimiento y de sanción contractual es alto.',
    }),
  },
  {
    id: 'experiencia_proyectos',
    nombre: 'Experiencia ejecutando proyectos',
    evaluar: (r) => ({
      cumple: r.experiencia_proyectos === true,
      razon: r.experiencia_proyectos === true
        ? 'Hay trayectoria ejecutando proyectos con alcance y cronograma definidos.'
        : 'La contratación pública se acredita con proyectos entregados: sin ese historial no hay soporte de experiencia habilitante.',
    }),
  },
  {
    id: 'experiencia_publica',
    nombre: 'Experiencia con entidades públicas',
    evaluar: (r) => ({
      cumple: r.experiencia_previa_contratos === true,
      razon: r.experiencia_previa_contratos === true
        ? `Ya existe relación contractual previa con el sector público${Number(r.num_contratos_previos) > 0 ? ` (${Number(r.num_contratos_previos)} procesos)` : ''}.`
        : 'No es descalificante, pero condiciona la estrategia: la entrada debe hacerse por mínima cuantía o por unión temporal con un tercero que sí tenga historial.',
    }),
  },
  {
    id: 'capacidad_operativa',
    nombre: 'Capacidad operativa',
    evaluar: (r) => ({
      cumple: r.capacidad_operativa === true,
      razon: r.capacidad_operativa === true
        ? 'La capacidad instalada permite asumir un contrato sin frenar la operación actual.'
        : 'Postular sin capacidad instalada disponible expone a la organización a incumplir plazos y a la efectividad de las pólizas.',
    }),
  },
];

export function evaluarElegibilidad(respuestas = {}) {
  const criterios = CRITERIOS.map((criterio) => {
    const resultado = criterio.evaluar(respuestas);
    return {
      id: criterio.id,
      nombre: criterio.nombre,
      descalificante: Boolean(criterio.descalificante),
      evaluado: resultado.cumple !== null && resultado.cumple !== undefined,
      cumple: resultado.cumple === true,
      razon: resultado.razon || 'Dato aún no capturado en la conversación.',
    };
  });

  const descalificado = criterios.some((c) => c.descalificante && c.evaluado && !c.cumple);
  const riesgos = criterios.filter((c) => c.evaluado && !c.cumple);
  const pendientes = criterios.filter((c) => !c.evaluado);

  const estado = descalificado ? 'no_elegible' : riesgos.length > 0 ? 'riesgo' : 'elegible';

  return {
    estado,
    criterios,
    riesgos,
    pendientes: pendientes.map((c) => c.id),
    cumplidos: criterios.filter((c) => c.cumple).length,
    total: criterios.length,
    mensaje: construirMensaje(estado, riesgos),
  };
}

function construirMensaje(estado, riesgos) {
  if (estado === 'no_elegible') {
    return 'RIESGO DE ELEGIBILIDAD CRÍTICO: la organización no cumple el requisito mínimo de antigüedad para relacionarse con el sector público en condiciones competitivas.';
  }
  if (estado === 'riesgo') {
    return `RIESGO DE ELEGIBILIDAD: se identificaron ${riesgos.length} condición(es) habilitante(s) sin cumplir (${riesgos
      .map((r) => r.nombre.toLowerCase())
      .join(', ')}). No impiden avanzar, pero deben resolverse antes de presentarse a un proceso formal.`;
  }
  return 'ELEGIBLE: la organización cumple las seis condiciones habilitantes básicas para iniciar su relacionamiento con el sector público.';
}

export const _internal = { CRITERIOS, construirMensaje };
