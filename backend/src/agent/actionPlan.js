// =====================================================================
// ETAPA 14 · Plan de accion 30 / 60 / 90 / 180 dias
// ---------------------------------------------------------------------
// El plan no es una lista generica de buenas practicas: se construye a
// partir de las brechas que el diagnostico realmente encontro, de la
// ruta de servicios IDEAPRO ya priorizada y de las entidades objetivo
// del mapa de oportunidades.
//
// Regla de secuenciacion (la misma logica de un consultor):
//   30 dias  -> habilitantes duros y de urgencia inmediata. Sin esto no
//               se puede presentar una oferta, punto.
//   60 dias  -> capacidad demostrable: documentar, acreditar, cerrar
//               brechas tecnicas y financieras de alta urgencia.
//   90 dias  -> posicionamiento: entrar al ecosistema publico, empezar
//               a rastrear procesos y construir relacionamiento.
//   180 dias -> escalamiento: postulacion efectiva, ruta de servicios y
//               consolidacion de la estrategia.
//
// Cada accion declara responsable, prioridad y resultado esperado, tal
// como exige el protocolo.
// =====================================================================

const HORIZONTES = [
  { id: '30_dias', dias: 30, titulo: 'Primeros 30 días', foco: 'Habilitantes críticos' },
  { id: '60_dias', dias: 60, titulo: 'Días 31 a 60', foco: 'Capacidad demostrable' },
  { id: '90_dias', dias: 90, titulo: 'Días 61 a 90', foco: 'Posicionamiento institucional' },
  { id: '180_dias', dias: 180, titulo: 'Días 91 a 180', foco: 'Escalamiento y postulación' },
];

// Catalogo de acciones. `aplica` decide si la accion entra al plan;
// `horizonte` la ubica en el tiempo. Estan ordenadas por criticidad
// dentro de cada horizonte.
const ACCIONES = [
  // ---------------------------------------------------------- 30 días
  {
    id: 'camara_comercio',
    horizonte: '30_dias',
    aplica: (r) => r.camara_comercio !== true,
    accion: 'Renovar el registro en Cámara de Comercio y verificar que el objeto social cubra los servicios que se van a ofertar.',
    responsable: 'Representante legal',
    prioridad: 'crítica',
    resultado: 'Certificado de existencia y representación legal vigente, con objeto social alineado a la oferta.',
  },
  {
    id: 'rup',
    horizonte: '30_dias',
    aplica: (r) => r.tiene_rup !== true,
    accion: 'Iniciar la inscripción del RUP: reunir estados financieros, experiencia clasificada en códigos UNSPSC y documentación societaria.',
    responsable: 'Representante legal con apoyo contable',
    prioridad: 'crítica',
    resultado: 'RUP radicado ante la Cámara de Comercio y en firme antes del día 45.',
  },
  {
    id: 'facultades',
    horizonte: '30_dias',
    aplica: (r, d) => d?.brechasPorFamilia?.some((b) => b.id === 'juridica' && b.faltantes.includes('verificación de facultades del representante')),
    accion: 'Verificar y, si aplica, ampliar las facultades del representante legal ante el máximo órgano social para suscribir contratos sin autorización previa.',
    responsable: 'Junta directiva o asamblea',
    prioridad: 'alta',
    resultado: 'Acta que acredita facultades suficientes para comprometer a la organización.',
  },
  {
    id: 'capital_trabajo',
    horizonte: '30_dias',
    aplica: (r) => r.capital_trabajo !== true,
    accion: 'Definir la fuente de capital de trabajo para ejecución (línea de crédito, cupo con proveedores o reserva de caja) y cuantificar el tope de exposición.',
    responsable: 'Dirección financiera',
    prioridad: 'crítica',
    resultado: 'Monto máximo de contrato que la organización puede asumir, respaldado por una fuente de liquidez identificada.',
  },
  {
    id: 'expediente',
    horizonte: '30_dias',
    aplica: (r) => r.gestion_documental !== true,
    accion: 'Consolidar el expediente documental en un repositorio único: financieros, certificaciones de experiencia, aportes a seguridad social, antecedentes y actas.',
    responsable: 'Administración',
    prioridad: 'alta',
    resultado: 'Carpeta habilitante completa y con control de vigencias, lista para responder a un proceso en menos de 48 horas.',
  },
  {
    id: 'problema_publico',
    horizonte: '30_dias',
    aplica: (r) => String(r.problema_que_resuelve || '').trim().length < 10,
    accion: 'Formular por escrito el problema público que resuelve la organización y traducir el portafolio a lenguaje de valor público.',
    responsable: 'Dirección general',
    prioridad: 'alta',
    resultado: 'Ficha de propuesta de valor que conecta el servicio con una necesidad pública contratable.',
  },

  // ---------------------------------------------------------- 60 días
  {
    id: 'casos_exito',
    horizonte: '60_dias',
    aplica: (r) => Number(r.casos_exito) < 2,
    accion: 'Documentar mínimo tres casos de éxito con evidencia verificable: alcance, cifras de resultado y certificación firmada por el cliente.',
    responsable: 'Líder técnico',
    prioridad: 'alta',
    resultado: 'Portafolio de experiencia acreditable, utilizable como requisito habilitante y como puntaje técnico.',
  },
  {
    id: 'procesos',
    horizonte: '60_dias',
    aplica: (r) => r.procesos_documentados !== true,
    accion: 'Documentar la metodología de prestación del servicio: procedimientos, tiempos, roles y protocolo de entrega.',
    responsable: 'Líder de operaciones',
    prioridad: 'alta',
    resultado: 'Manual operativo que soporta la propuesta técnica y reduce el riesgo de incumplimiento.',
  },
  {
    id: 'garantias',
    horizonte: '60_dias',
    aplica: (r) => r.capacidad_garantias !== true,
    accion: 'Abrir cupo con una aseguradora y cotizar las pólizas típicas del sector (seriedad de la oferta, cumplimiento, salarios y prestaciones).',
    responsable: 'Dirección financiera',
    prioridad: 'alta',
    resultado: 'Cupo de garantías aprobado y costo de pólizas incorporado a la estructura de precios.',
  },
  {
    id: 'indicadores_financieros',
    horizonte: '60_dias',
    aplica: (r, d) => d?.riesgoFinanciero?.nivel !== 'bajo',
    accion: 'Calcular los indicadores financieros habilitantes (liquidez, endeudamiento, razón de cobertura de intereses) y compararlos con los exigidos en procesos del sector.',
    responsable: 'Contador o revisor fiscal',
    prioridad: 'alta',
    resultado: 'Diagnóstico financiero que indica a qué cuantías puede aspirar hoy la organización.',
  },
  {
    id: 'pliegos',
    horizonte: '60_dias',
    aplica: (r) => r.conoce_pliegos !== true,
    accion: 'Capacitar al equipo en lectura de pliegos, requisitos habilitantes y criterios de evaluación, analizando tres procesos reales ya cerrados del sector.',
    responsable: 'Equipo comercial y jurídico',
    prioridad: 'media',
    resultado: 'Capacidad interna para decidir en menos de un día si conviene o no presentarse a un proceso.',
  },

  // ---------------------------------------------------------- 90 días
  {
    id: 'secop',
    horizonte: '90_dias',
    aplica: (r) => r.conoce_secop !== true,
    accion: 'Crear el usuario en SECOP II, configurar alertas por códigos UNSPSC y establecer una rutina semanal de revisión de procesos.',
    responsable: 'Responsable comercial',
    prioridad: 'alta',
    resultado: 'Flujo permanente de oportunidades filtradas por sector y territorio.',
  },
  {
    id: 'planes_desarrollo',
    horizonte: '90_dias',
    aplica: (r) => r.conoce_planes_desarrollo !== true,
    accion: 'Analizar el plan de desarrollo y el plan anual de adquisiciones de las entidades objetivo para identificar dónde está presupuestada la necesidad que resuelven.',
    responsable: 'Responsable comercial',
    prioridad: 'alta',
    resultado: 'Mapa de metas y recursos donde la oferta de la organización tiene cabida presupuestal.',
  },
  {
    id: 'mga',
    horizonte: '90_dias',
    aplica: (r) => r.conoce_mga !== true,
    accion: 'Formarse en el ciclo de la inversión pública (MGA, bancos de proyectos, SGR) para poder acompañar a la entidad en la estructuración y no solo responder al pliego.',
    responsable: 'Equipo técnico',
    prioridad: 'media',
    resultado: 'Capacidad de participar antes de la publicación del proceso, en la fase de estructuración de la necesidad.',
  },
  {
    id: 'comercial',
    horizonte: '90_dias',
    aplica: (r) => r.equipo_comercial_dedicado !== true,
    accion: 'Asignar formalmente un responsable de mercado público, con dedicación e indicadores propios de gestión.',
    responsable: 'Dirección general',
    prioridad: 'media',
    resultado: 'Gestión pública con dueño, metas y seguimiento, no dependiente de la disponibilidad del gerente.',
  },
  {
    id: 'presencia_digital',
    horizonte: '90_dias',
    aplica: (r, d) => d?.brechasPorFamilia?.some((b) => b.id === 'tecnologica' && b.estado === 'con_brecha'),
    accion: 'Construir la presencia institucional en línea (sitio o ficha digital) con portafolio, experiencia y datos de contacto verificables.',
    responsable: 'Comunicaciones',
    prioridad: 'media',
    resultado: 'Respaldo reputacional consultable por el comité evaluador de la entidad.',
  },

  // --------------------------------------------------------- 180 días
  {
    id: 'escalabilidad',
    horizonte: '180_dias',
    aplica: (r) => r.capacidad_escalar !== true,
    accion: 'Diseñar el modelo de escalamiento: perfiles clave, esquema de subcontratación y protocolo para ejecutar dos contratos simultáneos.',
    responsable: 'Dirección de operaciones',
    prioridad: 'media',
    resultado: 'Capacidad verificable para asumir más de un contrato sin comprometer la calidad.',
  },
  {
    id: 'certificaciones',
    horizonte: '180_dias',
    aplica: (r) => r.certificaciones !== true,
    accion: 'Iniciar la ruta de certificación de calidad o de habilitación sectorial que otorgue puntaje adicional en los procesos objetivo.',
    responsable: 'Líder de calidad',
    prioridad: 'media',
    resultado: 'Certificación en trámite o expedida, con impacto directo en el puntaje técnico.',
  },
  {
    id: 'union_temporal',
    horizonte: '180_dias',
    aplica: (r) => r.experiencia_previa_contratos !== true,
    accion: 'Identificar aliados con experiencia pública acreditada y estructurar una unión temporal o consorcio para la primera postulación.',
    responsable: 'Dirección general',
    prioridad: 'alta',
    resultado: 'Primera postulación presentada con respaldo de experiencia habilitante de un tercero.',
  },
  {
    id: 'primera_postulacion',
    horizonte: '180_dias',
    aplica: () => true,
    accion: 'Presentar al menos dos ofertas en procesos de cuantía baja dentro de las entidades objetivo priorizadas.',
    responsable: 'Responsable comercial',
    prioridad: 'alta',
    resultado: 'Participación efectiva en el mercado público y retroalimentación real del comité evaluador.',
  },
];

/**
 * Construye el plan de acción 30/60/90/180.
 * @param {object} params
 * @param {object} params.respuestas respuestas planas de la sesión
 * @param {object} params.diagnostico salida de calcularDiagnostico()
 * @param {Array}  params.ruta ruta de servicios IDEAPRO ya priorizada
 * @param {object} params.mapaEntidades salida de construirMapaEntidades()
 */
export function construirPlanAccion({ respuestas = {}, diagnostico, ruta = [], mapaEntidades } = {}) {
  const entrada = mapaEntidades?.entrada_recomendada;

  const seleccionadas = ACCIONES
    .filter((accion) => {
      try {
        return accion.aplica(respuestas, diagnostico);
      } catch {
        return false;
      }
    })
    .map(({ aplica, ...resto }) => ({ ...resto }));

  // Las acciones derivadas de la ruta IDEAPRO se distribuyen según la
  // prioridad con la que el motor de recomendación las ordenó: la
  // primera es la que ataca el eje crítico y por eso arranca temprano.
  const accionesRuta = ruta.slice(0, 4).map((item, indice) => ({
    id: `servicio_${item.servicio_id}`,
    horizonte: HORIZONTES[Math.min(indice, HORIZONTES.length - 1)].id,
    accion: `Iniciar el servicio IDEAPRO "${item.servicio?.nombre_servicio || item.nombre}".`,
    responsable: 'Dirección general con acompañamiento IDEAPRO',
    prioridad: indice === 0 ? 'crítica' : 'media',
    resultado: item.justificacion || 'Cierre de la brecha priorizada en el diagnóstico.',
    origen: 'ruta_ideapro',
  }));

  if (entrada) {
    accionesRuta.push({
      id: 'entidad_objetivo',
      horizonte: '90_dias',
      accion: `Construir relacionamiento con ${entrada.ejemplo_territorial || entrada.nombre}: solicitar reunión técnica y presentar el portafolio en clave de valor público.`,
      responsable: 'Dirección general',
      prioridad: 'alta',
      resultado: 'Primer contacto institucional documentado con la entidad de entrada priorizada.',
      origen: 'mapa_entidades',
    });
  }

  const todas = [...seleccionadas, ...accionesRuta];

  const horizontes = HORIZONTES.map((horizonte) => ({
    id: horizonte.id,
    dias: horizonte.dias,
    titulo: horizonte.titulo,
    foco: horizonte.foco,
    acciones: todas
      .filter((accion) => accion.horizonte === horizonte.id)
      .sort((a, b) => ordenPrioridad(a.prioridad) - ordenPrioridad(b.prioridad))
      .map(({ horizonte: _h, ...accion }) => accion),
  }));

  return {
    horizontes,
    total_acciones: todas.length,
    acciones_criticas: todas.filter((a) => a.prioridad === 'crítica').length,
  };
}

function ordenPrioridad(prioridad) {
  return { crítica: 0, alta: 1, media: 2, baja: 3 }[prioridad] ?? 3;
}

export const _internal = { ACCIONES, HORIZONTES };
