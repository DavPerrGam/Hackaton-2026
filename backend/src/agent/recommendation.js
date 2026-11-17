// =====================================================================
// Motor de recomendación y ruta de crecimiento
// ---------------------------------------------------------------------
// Entrada:  diagnóstico (scores + índice + nivel + eje crítico),
//           catálogo de servicios activos, dependencias entre ellos.
// Salida:   lista ordenada de { servicio, orden_prioridad, justificacion,
//           tipo: 'principal' | 'prerequisito' | 'cross_sell' }
//
// Reglas de negocio implementadas (trazables a "Funcionalidades
// esperadas" del reto):
//   1. Elegibilidad: un servicio solo se recomienda si el nivel de
//      madurez global de la empresa es >= nivel_minimo_requerido del
//      servicio, y su índice IDEAPRO >= indice_minimo.
//   2. Prioridad: primero los servicios cuyo eje_relacionado coincide
//      con el eje_critico_identificado (la brecha más urgente).
//      Luego el resto de ejes, ordenados de menor a mayor score (lo
//      más débil primero).
//   3. Prerrequisitos: si un servicio recomendado tiene una dependencia
//      marcada es_obligatorio = true y ese prerrequisito no está ya en
//      la ruta, se inserta ANTES automáticamente (evita mandar a la
//      empresa a "Mentoría Comercial" sin haber resuelto el RUP).
//   4. Cross-selling: una vez cubierto el eje crítico, se agregan como
//      sugerencias complementarias los servicios cuyo eje_relacionado
//      o ejes_secundarios coincidan con los otros ejes débiles de la
//      empresa (score < 60), evitando recomendar el catálogo completo
//      de forma genérica.
// =====================================================================

const NIVEL_ORDEN = {
  inicial: 0,
  exploracion: 0,
  en_desarrollo: 1,
  preparacion: 1,
  intermedio: 2,
  lista_para_explorar: 2,
  avanzado: 3,
  preparada: 3,
  consolidada: 4,
};

function esElegible(servicio, diagnostico) {
  const nivelOk =
    !servicio.nivel_minimo_requerido ||
    NIVEL_ORDEN[diagnostico.nivelMadurezGlobal] >= NIVEL_ORDEN[servicio.nivel_minimo_requerido];
  const indiceOk = diagnostico.indiceIdeapro >= (servicio.indice_minimo || 0);
  return nivelOk && indiceOk;
}

function justificacionTemplate(servicio, diagnostico, motivo) {
  const score = diagnostico.scores[servicio.eje_relacionado];
  switch (motivo) {
    case 'critico':
      return `Tu eje "${servicio.eje_relacionado}" quedó en ${score}/100, el más urgente de resolver según tu diagnóstico. ${servicio.descripcion_corta || servicio.nombre_servicio} está diseñado exactamente para eso.`;
    case 'prerequisito':
      return `Antes de avanzar con el servicio que necesitas, IDEAPRO recomienda resolver primero "${servicio.nombre_servicio}" para no arriesgar el resto del proceso.`;
    case 'cross_sell':
      return `Además de tu prioridad principal, tu eje "${servicio.eje_relacionado}" (${score}/100) también tiene espacio de mejora. Este servicio complementa tu ruta.`;
    default:
      return servicio.descripcion_corta || servicio.descripcion;
  }
}

export function construirRutaRecomendada({ diagnostico, catalogo, dependencias }) {
  const elegibles = catalogo.filter((s) => esElegible(s, diagnostico));
  if (elegibles.length === 0) return [];

  const depsPorServicio = new Map();
  for (const dep of dependencias) {
    if (!depsPorServicio.has(dep.servicio_id)) depsPorServicio.set(dep.servicio_id, []);
    depsPorServicio.get(dep.servicio_id).push(dep);
  }

  const ruta = [];
  const idsEnRuta = new Set();

  const agregar = (servicio, motivo) => {
    if (idsEnRuta.has(servicio.id)) return;

    // Resolver prerrequisitos obligatorios primero (recursivo, evita ciclos simples)
    const deps = depsPorServicio.get(servicio.id) || [];
    for (const dep of deps) {
      if (!dep.es_obligatorio) continue;
      const prereq = catalogo.find((s) => s.id === dep.prerequisito_id);
      if (prereq && !idsEnRuta.has(prereq.id)) {
        agregar(prereq, 'prerequisito');
      }
    }

    idsEnRuta.add(servicio.id);
    ruta.push({
      servicio_id: servicio.id,
      servicio,
      justificacion: justificacionTemplate(servicio, diagnostico, motivo),
      tipo: motivo,
    });
  };

  // 1) Servicios del eje crítico primero
  const delEjeCritico = elegibles
    .filter((s) => s.eje_relacionado === diagnostico.ejeCritico)
    .sort((a, b) => (a.orden_catalogo || 0) - (b.orden_catalogo || 0));
  delEjeCritico.forEach((s) => agregar(s, 'critico'));

  // 2) Cross-selling: ejes débiles (score < 60) distintos al crítico,
  //    ordenados del más débil al menos débil.
  const ejesDebiles = Object.entries(diagnostico.scores)
    .filter(([eje, score]) => eje !== diagnostico.ejeCritico && score < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([eje]) => eje);

  for (const eje of ejesDebiles) {
    const candidatos = elegibles
      .filter((s) => s.eje_relacionado === eje || (s.ejes_secundarios || []).includes(eje))
      .sort((a, b) => (a.orden_catalogo || 0) - (b.orden_catalogo || 0));
    candidatos.forEach((s) => agregar(s, 'cross_sell'));
  }

  // Orden final de prioridad: 1..n en el orden en que fueron agregados
  return ruta.map((item, idx) => ({ ...item, orden_prioridad: idx + 1 }));
}
