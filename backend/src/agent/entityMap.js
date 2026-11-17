// =====================================================================
// ETAPA 10 · Mapa de oportunidades: que entidades podrian requerir
// los servicios de la organizacion, y por que
// ---------------------------------------------------------------------
// A diferencia de opportunityMatch.js -que cruza la organizacion con
// procesos y tipos de oportunidad concretos existentes en la base-,
// este modulo responde la pregunta estrategica del protocolo Nexus:
// "quien, dentro del Estado colombiano, tiene el problema que ustedes
// resuelven y el presupuesto para resolverlo".
//
// La priorizacion combina tres factores:
//   1. Afinidad tematica: la entidad aparece como comprador de alguna
//      de las cadenas de valor publico (valueProposition.js).
//   2. Alcance territorial: no tiene sentido sugerir un ministerio a
//      una organizacion con cobertura estrictamente municipal.
//   3. Nivel de madurez: las entidades del orden nacional exigen mas
//      trayectoria acreditada que una alcaldia de categoria 5.
// =====================================================================

const ENTIDADES = {
  alcaldias: {
    nombre: 'Alcaldías municipales',
    ambito: 'municipal',
    alcanceMinimo: 'local',
    nivelMinimo: 1,
    porQue: 'Ejecutan directamente el plan de desarrollo municipal y concentran el mayor volumen de procesos de mínima cuantía, la puerta de entrada natural al mercado público.',
  },
  gobernaciones: {
    nombre: 'Gobernaciones departamentales',
    ambito: 'departamental',
    alcanceMinimo: 'departamental',
    nivelMinimo: 2,
    porQue: 'Administran recursos del departamento y del Sistema General de Regalías, con procesos de mayor cuantía y alcance supramunicipal.',
  },
  ministerios: {
    nombre: 'Ministerios y entidades del orden nacional',
    ambito: 'nacional',
    alcanceMinimo: 'regional',
    nivelMinimo: 4,
    porQue: 'Definen la política sectorial y contratan operadores para programas de cobertura nacional; exigen trayectoria acreditada y capacidad de ejecución simultánea.',
  },
  agencias_nacionales: {
    nombre: 'Agencias nacionales (ADR, ART, APC, iNNpulsa, ANT)',
    ambito: 'nacional',
    alcanceMinimo: 'regional',
    nivelMinimo: 3,
    porQue: 'Operan programas con enfoque territorial y suelen contratar operadores regionales especializados, con requisitos menos exigentes que un ministerio.',
  },
  institutos_descentralizados: {
    nombre: 'Institutos y establecimientos públicos descentralizados',
    ambito: 'municipal',
    alcanceMinimo: 'local',
    nivelMinimo: 2,
    porQue: 'Tienen presupuesto y autonomía contractual propios (institutos de deporte, cultura, tránsito, vivienda), con menos competencia que la alcaldía central.',
  },
  ese_hospitales: {
    nombre: 'ESE y hospitales públicos',
    ambito: 'municipal',
    alcanceMinimo: 'local',
    nivelMinimo: 2,
    porQue: 'Contratan de forma permanente bienes, servicios y soluciones de gestión bajo régimen especial, con procesos recurrentes y presupuesto propio.',
  },
  secretarias_educacion: {
    nombre: 'Secretarías de Educación certificadas',
    ambito: 'departamental',
    alcanceMinimo: 'local',
    nivelMinimo: 2,
    porQue: 'Manejan recursos del Sistema General de Participaciones para calidad y cobertura educativa, con contratación anual programable.',
  },
  secretarias_salud: {
    nombre: 'Secretarías de Salud territoriales',
    ambito: 'departamental',
    alcanceMinimo: 'local',
    nivelMinimo: 2,
    porQue: 'Ejecutan el Plan de Intervenciones Colectivas y programas de salud pública con contratación anual.',
  },
  instituciones_educativas: {
    nombre: 'Instituciones educativas oficiales',
    ambito: 'municipal',
    alcanceMinimo: 'local',
    nivelMinimo: 1,
    porQue: 'Administran fondos de servicios educativos con cuantías bajas: excelente escenario para construir experiencia acreditable rápido.',
  },
  universidades_publicas: {
    nombre: 'Universidades públicas',
    ambito: 'departamental',
    alcanceMinimo: 'departamental',
    nivelMinimo: 3,
    porQue: 'Contratan bajo régimen especial y financian proyectos de investigación, extensión e infraestructura con recursos propios y de CTeI.',
  },
  empresas_servicios_publicos: {
    nombre: 'Empresas de servicios públicos domiciliarios',
    ambito: 'departamental',
    alcanceMinimo: 'departamental',
    nivelMinimo: 3,
    porQue: 'Manejan planes de inversión plurianuales en acueducto, aseo y energía, con contratación técnica exigente y recurrente.',
  },
  corporaciones_autonomas: {
    nombre: 'Corporaciones Autónomas Regionales (CAR)',
    ambito: 'regional',
    alcanceMinimo: 'departamental',
    nivelMinimo: 3,
    porQue: 'Ejecutan el plan de acción ambiental regional con recursos de sobretasa ambiental y regalías, en temas de agua, bosque y riesgo.',
  },
  camaras_comercio: {
    nombre: 'Cámaras de Comercio y entidades gremiales',
    ambito: 'departamental',
    alcanceMinimo: 'local',
    nivelMinimo: 2,
    porQue: 'Operan programas de fortalecimiento empresarial con recursos públicos y de cooperación, con procesos ágiles y aliados recurrentes.',
  },
  cooperacion_internacional: {
    nombre: 'Cooperación internacional y banca multilateral',
    ambito: 'nacional',
    alcanceMinimo: 'regional',
    nivelMinimo: 3,
    porQue: 'Financian proyectos territoriales con recursos no reembolsables; valoran más el enfoque metodológico y la evidencia de impacto que el volumen financiero.',
  },
};

const ORDEN_ALCANCE = { local: 1, departamental: 2, regional: 3, nacional: 4 };

/**
 * Construye el mapa de entidades objetivo.
 * @param {object} params
 * @param {string[]} params.compradores tipos de entidad sugeridos por el perfilamiento
 * @param {object} params.respuestas respuestas planas de la sesión
 * @param {object} params.diagnostico salida de calcularDiagnostico()
 */
export function construirMapaEntidades({ compradores = [], respuestas = {}, diagnostico }) {
  const alcanceEmpresa = ORDEN_ALCANCE[respuestas.cobertura_territorial] || 1;
  const nivel = diagnostico?.nivelMadurez?.nivel || 1;
  const ciudad = String(respuestas.ubicacion_ciudad || '').trim();
  const departamento = String(respuestas.ubicacion_departamento || '').trim();

  const priorizadas = compradores
    .map((id) => {
      const entidad = ENTIDADES[id];
      if (!entidad) return null;

      const alcanceRequerido = ORDEN_ALCANCE[entidad.alcanceMinimo] || 1;
      const cubreTerritorio = alcanceEmpresa >= alcanceRequerido;
      const madurezSuficiente = nivel >= entidad.nivelMinimo;

      // La prioridad castiga tanto el exceso de ambición (entidad
      // nacional con organización municipal) como la subutilización.
      let prioridad = 100;
      if (!cubreTerritorio) prioridad -= 35;
      if (!madurezSuficiente) prioridad -= 30 * (entidad.nivelMinimo - nivel);
      prioridad -= Math.max(0, alcanceRequerido - alcanceEmpresa) * 5;

      const barreras = [];
      if (!cubreTerritorio) {
        barreras.push(`Requiere cobertura ${entidad.alcanceMinimo} y hoy la organización opera a nivel ${respuestas.cobertura_territorial || 'local'}.`);
      }
      if (!madurezSuficiente) {
        barreras.push(`Exige un nivel de madurez ${entidad.nivelMinimo} y la organización está en nivel ${nivel}.`);
      }

      return {
        id,
        nombre: entidad.nombre,
        ambito: entidad.ambito,
        por_que: entidad.porQue,
        prioridad: Math.max(0, Math.round(prioridad)),
        accesible_hoy: cubreTerritorio && madurezSuficiente,
        barreras,
        ejemplo_territorial: ejemploTerritorial(entidad, ciudad, departamento),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.prioridad - a.prioridad);

  const accesibles = priorizadas.filter((e) => e.accesible_hoy);

  return {
    entidades: priorizadas,
    accesibles_hoy: accesibles.map((e) => e.nombre),
    // La entrada recomendada es la entidad accesible con mayor
    // prioridad; si ninguna es accesible, se devuelve la menos exigente
    // para que la ruta apunte a hacerla accesible.
    entrada_recomendada: accesibles[0] || priorizadas[priorizadas.length - 1] || null,
    territorio: { ciudad: ciudad || null, departamento: departamento || null },
  };
}

function ejemploTerritorial(entidad, ciudad, departamento) {
  if (entidad.ambito === 'municipal' && ciudad) return `${entidad.nombre} de ${ciudad}`;
  if ((entidad.ambito === 'departamental' || entidad.ambito === 'regional') && departamento) {
    return `${entidad.nombre} de ${departamento}`;
  }
  return entidad.nombre;
}

export const _internal = { ENTIDADES, ORDEN_ALCANCE };
