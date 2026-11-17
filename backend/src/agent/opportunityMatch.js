// =====================================================================
// Motor de encaje con oportunidades de mercado público
// ---------------------------------------------------------------------
// Para cada tipo_oportunidad activo, compara los requisitos_por_eje
// (umbral mínimo esperado por eje) contra los scores reales del
// diagnóstico y produce:
//   - porcentaje_encaje: promedio de cumplimiento por eje, capado en
//     100 por eje (superar el requisito no suma puntos extra, evita
//     que un solo eje muy fuerte oculte brechas en los demás).
//   - brechas_identificadas: ejes donde el score no alcanza el
//     requisito, con la magnitud de la brecha, para que el frontend
//     pueda explicarle a la empresa exactamente qué le falta.
// =====================================================================

export function calcularEncajeOportunidades(diagnostico, tiposOportunidad, sectorNombre) {
  return tiposOportunidad.map((oportunidad) => {
    const sectores = (oportunidad.sectores_aplicables || []).map(texto);
    if (sectorNombre && sectores.length && !sectores.includes(texto(sectorNombre))) return null;
    const requisitos = oportunidad.requisitos_por_eje || {};
    const ejes = Object.keys(requisitos);

    if (ejes.length === 0) {
      return { oportunidad, porcentajeEncaje: 100, brechas: [] };
    }

    let sumaCumplimiento = 0;
    const brechas = [];

    for (const eje of ejes) {
      const requerido = Number(requisitos[eje]) || 0;
      const real = diagnostico.scores[eje] ?? 0;
      const cumplimiento = requerido === 0 ? 100 : Math.min(100, (real / requerido) * 100);
      sumaCumplimiento += cumplimiento;

      if (real < requerido) {
        brechas.push({ eje, requerido, real, brecha: requerido - real });
      }
    }

    const porcentajeEncaje = Math.round(sumaCumplimiento / ejes.length);

    return {
      oportunidad,
      porcentajeEncaje,
      brechas: brechas.sort((a, b) => b.brecha - a.brecha),
    };
  }).filter(Boolean).sort((a, b) => b.porcentajeEncaje - a.porcentajeEncaje);
}

const EJES = ['oferta', 'experiencia', 'operativa', 'legal', 'financiera', 'comercial'];

function texto(valor) {
  return String(valor ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function lista(valor) {
  if (Array.isArray(valor)) return valor.map(texto).filter(Boolean);
  if (typeof valor === 'string') return valor.split(/[,;|]/).map(texto).filter(Boolean);
  return valor ? [texto(valor)] : [];
}

function primerValor(objeto, nombres) {
  return nombres.map((nombre) => objeto?.[nombre]).find((valor) => valor !== undefined && valor !== null && valor !== '');
}

function coincideRequisito(requisito, valor) {
  const requeridos = lista(requisito);
  const actual = lista(valor);
  if (requeridos.length === 0 || actual.length === 0) return requeridos.length === 0;
  return requeridos.some((item) => actual.some((candidato) => candidato.includes(item) || item.includes(candidato)));
}

function obtenerPerfil(respuestas = {}, empresa = {}) {
  return {
    sector: primerValor(respuestas, ['sector_texto', 'sector', 'sector_nombre']) || empresa.sector_nombre,
    productos: primerValor(respuestas, ['producto_servicio', 'productos_servicios', 'tipo_bien_servicio', 'oferta', 'actividad_economica']),
    territorio: primerValor(respuestas, ['territorio', 'municipio', 'ciudad', 'departamento', 'ubicacion']),
    presupuesto: Number(primerValor(respuestas, ['presupuesto', 'presupuesto_disponible', 'capacidad_financiera'])) || undefined,
    documentos: lista(primerValor(respuestas, ['documentos', 'documentos_disponibles'])),
    scores: respuestas.scores || {},
  };
}

function requisitosDe(oportunidad) {
  const requisitos = oportunidad.requisitos || {};
  return {
    sectores: primerValor(requisitos, ['sectores', 'sector', 'sector_texto']),
    productos: primerValor(requisitos, ['productos_servicios', 'productos', 'servicios', 'objeto']),
    territorios: primerValor(requisitos, ['territorios', 'territorio', 'departamentos', 'municipios']) || oportunidad.territorio,
    presupuestoMin: Number(primerValor(requisitos, ['presupuesto_min', 'presupuesto_minimo', 'valor_minimo'])) || undefined,
    presupuestoMax: Number(primerValor(requisitos, ['presupuesto_max', 'presupuesto_maximo', 'valor_maximo'])) || undefined,
    ejes: requisitos.requisitos_por_eje || requisitos.ejes || {},
    documentos: lista(requisitos.documentos || requisitos.requisitos),
  };
}

function oportunidadVigente(oportunidad, ahora) {
  if (oportunidad.estado && oportunidad.estado !== 'abierta') return false;
  return !oportunidad.fecha_cierre || new Date(oportunidad.fecha_cierre) >= ahora;
}

function puntuacionEjes(scores, requisitos) {
  const ejes = Object.entries(requisitos.ejes).filter(([, valor]) => Number(valor) > 0);
  if (ejes.length === 0) return { puntos: 100, brechas: [], fortalezas: [] };
  let suma = 0;
  const brechas = [];
  const fortalezas = [];
  for (const [eje, requerido] of ejes) {
    const real = Number(scores[eje] || 0);
    const cumplimiento = Math.min(100, (real / Number(requerido)) * 100);
    suma += cumplimiento;
    if (real < requerido) brechas.push({ eje, requerido: Number(requerido), real, brecha: Number(requerido) - real });
    else fortalezas.push({ eje, score: real });
  }
  return { puntos: Math.round(suma / ejes.length), brechas, fortalezas };
}

export function identificarOportunidadesReales(diagnostico, oportunidades, respuestas = {}, empresa = {}, ahora = new Date()) {
  const perfil = obtenerPerfil({ ...respuestas, scores: diagnostico.scores }, empresa);
  return oportunidades
    .filter((oportunidad) => oportunidadVigente(oportunidad, ahora))
    .map((oportunidad) => {
      const requisitos = requisitosDe(oportunidad);
      const filtros = [];
      if (requisitos.sectores && !coincideRequisito(requisitos.sectores, perfil.sector)) return null;
      if (requisitos.productos && !coincideRequisito(requisitos.productos, perfil.productos)) return null;
      if (requisitos.territorios && !coincideRequisito(requisitos.territorios, perfil.territorio)) return null;
      if (requisitos.presupuestoMin && (!perfil.presupuesto || perfil.presupuesto < requisitos.presupuestoMin)) return null;
      if (requisitos.presupuestoMax && perfil.presupuesto && perfil.presupuesto > requisitos.presupuestoMax) return null;

      const eje = puntuacionEjes(perfil.scores, requisitos);
      const atributos = [
        ['sector', requisitos.sectores, perfil.sector],
        ['producto_servicio', requisitos.productos, perfil.productos],
        ['territorio', requisitos.territorios, perfil.territorio],
        ['presupuesto', requisitos.presupuestoMin || requisitos.presupuestoMax, perfil.presupuesto],
      ];
      const coincidencias = atributos.filter(([, requerido, actual]) => requerido && actual);
      const puntosAtributos = coincidencias.length
        ? Math.round(coincidencias.reduce((total, [, requerido, actual]) => total + (coincideRequisito(requerido, actual) ? 100 : 0), 0) / coincidencias.length)
        : 100;
      const documentosFaltantes = requisitos.documentos.filter((documento) => !perfil.documentos.includes(documento));
      const puntosRequisitos = requisitos.documentos.length === 0
        ? 100
        : Math.round(((requisitos.documentos.length - documentosFaltantes.length) / requisitos.documentos.length) * 100);
      const puntuacion = Math.round((eje.puntos * 0.55) + (puntosAtributos * 0.3) + (puntosRequisitos * 0.15));

      if (eje.brechas.length) filtros.push('Cerrar brechas de capacidad antes de postular');
      if (documentosFaltantes.length) filtros.push('Validar requisitos documentales');
      const fecha = oportunidad.fecha_cierre ? new Date(oportunidad.fecha_cierre) : null;
      const accion = puntuacion >= 75 && eje.brechas.length === 0 && documentosFaltantes.length === 0
        ? 'Preparar y presentar la postulación'
        : 'Cerrar las brechas prioritarias y revisar requisitos antes de postular';

      return {
        oportunidad,
        porcentajeEncaje: puntuacion,
        conveniencia: puntuacion >= 75 ? 'alta' : puntuacion >= 50 ? 'media' : 'baja',
        brechas: [
          ...eje.brechas,
          ...(documentosFaltantes.length > 0 ? [{
            eje: 'requisitos',
            requerido: requisitos.documentos.length,
            real: requisitos.documentos.length - documentosFaltantes.length,
            brecha: documentosFaltantes.length,
            faltantes: documentosFaltantes,
          }] : []),
        ].sort((a, b) => b.brecha - a.brecha),
        fortalezas: eje.fortalezas,
        accionRecomendada: accion,
        filtrosAplicados: filtros,
        fechaCierre: fecha?.toISOString() || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.porcentajeEncaje - a.porcentajeEncaje || (a.fechaCierre || '').localeCompare(b.fechaCierre || ''));
}
