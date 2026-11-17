// =====================================================================
// ETAPA 11 · Relaciones empresariales
// ---------------------------------------------------------------------
// El protocolo no se conforma con diagnosticar una organizacion aislada:
// pide compararla contra las demas organizaciones ya registradas para
// responder dos preguntas de negocio de IDEAPRO (REDPRO):
//   - ¿a quien se parece? (para agrupar y ofrecer lo mismo a un grupo),
//   - ¿con quien podria aliarse? (union temporal, consorcio, oferta
//     conjunta) para acreditar lo que hoy no puede acreditar sola.
//
// La similitud se calcula sobre las salidas ya calculadas de otras
// etapas -clasificacion, tags, compradores publicos, sector y problema
// declarado- y NUNCA sobre datos sensibles: este modulo solo recibe y
// devuelve informacion de perfil publico (nombre, tipo, territorio).
//
// Formula (0-100), ponderada segun cuanto predice cada senal que dos
// organizaciones compitan o se complementen en el mismo mercado:
//   40  categorias (Jaccard ponderado por afinidad)
//   25  tags estandarizados (Jaccard)
//   15  compradores publicos en comun
//   10  sector economico declarado
//   10  problema que resuelven (solape de terminos de contenido)
//
// La lectura de la relacion (competencia o complemento) no sale del
// puntaje sino de las capacidades: dos organizaciones muy parecidas que
// tienen la MISMA brecha compiten; si una cubre lo que a la otra le
// falta, se complementan. Eso es lo que convierte un porcentaje en una
// recomendacion accionable.
// =====================================================================

const PALABRAS_VACIAS = new Set([
  'para', 'con', 'los', 'las', 'del', 'que', 'una', 'uno', 'por', 'sus', 'sin',
  'este', 'esta', 'como', 'mas', 'muy', 'entre', 'sobre', 'desde', 'hasta',
  'donde', 'cuando', 'porque', 'ellos', 'nuestro', 'nuestra', 'servicio',
  'servicios', 'empresa', 'organizacion', 'cliente', 'clientes',
]);

function normalizar(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Acepta tanto la salida completa de generarTags() como un arreglo de
// tags o de cadenas, y devuelve el mapa clave normalizada -> etiqueta
// original. La clave sirve para comparar; la etiqueta, para mostrar.
function mapaDeTags(tags) {
  const lista = Array.isArray(tags)
    ? tags.map((t) => (typeof t === 'string' ? t : t?.tag))
    : Array.isArray(tags?.lista) ? tags.lista : [];
  return new Map(lista.filter(Boolean).map((etiqueta) => [normalizar(etiqueta), etiqueta]));
}

function terminosDeContenido(texto) {
  return new Set(
    normalizar(texto)
      .split(/[^a-z0-9]+/)
      .filter((palabra) => palabra.length >= 4 && !PALABRAS_VACIAS.has(palabra))
  );
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let interseccion = 0;
  for (const valor of a) if (b.has(valor)) interseccion += 1;
  return interseccion / (a.size + b.size - interseccion);
}

// Jaccard ponderado: dos organizaciones con "GovTech 90%" se parecen
// mas entre si que una con 90% y otra con 30%, aunque ambas compartan
// la categoria.
function afinidadCompartida(categoriasA = [], categoriasB = []) {
  const mapaA = new Map(categoriasA.map((c) => [c.id, c.afinidad || 0]));
  const mapaB = new Map(categoriasB.map((c) => [c.id, c.afinidad || 0]));
  const ids = new Set([...mapaA.keys(), ...mapaB.keys()]);
  if (ids.size === 0) return { puntaje: 0, comunes: [] };

  let minimos = 0;
  let maximos = 0;
  const comunes = [];
  for (const id of ids) {
    const a = mapaA.get(id) || 0;
    const b = mapaB.get(id) || 0;
    minimos += Math.min(a, b);
    maximos += Math.max(a, b);
    if (a > 0 && b > 0) {
      const nombre = categoriasA.find((c) => c.id === id)?.nombre
        || categoriasB.find((c) => c.id === id)?.nombre;
      comunes.push({ id, nombre, afinidad: Math.min(a, b) });
    }
  }
  return {
    puntaje: maximos === 0 ? 0 : minimos / maximos,
    comunes: comunes.sort((x, y) => y.afinidad - x.afinidad),
  };
}

/**
 * Construye el "perfil comparable" de una organización: lo mínimo que
 * necesita este módulo, ya normalizado. Se usa tanto para la
 * organización diagnosticada como para cada candidata del ecosistema.
 */
export function perfilComparable({
  empresaId,
  nombre,
  tipoOrganizacion = null,
  ciudad = null,
  departamento = null,
  sector = null,
  clasificacion = {},
  tags = [],
  perfilamiento = {},
  nivelMadurez = null,
  capacidades = {},
}) {
  const etiquetasTags = mapaDeTags(tags);
  return {
    empresaId,
    nombre,
    tipoOrganizacion,
    ciudad,
    departamento,
    sector: normalizar(sector),
    categorias: clasificacion?.categorias || [],
    tags: new Set(etiquetasTags.keys()),
    etiquetasTags,
    compradores: new Set((perfilamiento?.compradores || []).map(normalizar)),
    problema: terminosDeContenido(
      [perfilamiento?.cadenas?.[0]?.problema, perfilamiento?.resumen].filter(Boolean).join(' ')
    ),
    nivelMadurez,
    // Capacidades habilitantes: deciden si la relación es de
    // competencia o de complemento.
    capacidades: {
      rup: capacidades.rup === true,
      experienciaPublica: capacidades.experienciaPublica === true,
      capacidadFinanciera: capacidades.capacidadFinanciera === true,
      cobertura: capacidades.cobertura || null,
    },
  };
}

const PESOS = { categorias: 40, tags: 25, compradores: 15, sector: 10, problema: 10 };

function compararPar(base, candidata) {
  const categorias = afinidadCompartida(base.categorias, candidata.categorias);
  // Se reportan con la etiqueta original, no con la clave normalizada:
  // "Gestión documental" y no "gestion documental".
  const tagsComunes = [...base.tags]
    .filter((tag) => candidata.tags.has(tag))
    .map((tag) => base.etiquetasTags.get(tag) || tag);

  const componentes = {
    categorias: Math.round(categorias.puntaje * PESOS.categorias),
    tags: Math.round(jaccard(base.tags, candidata.tags) * PESOS.tags),
    compradores: Math.round(jaccard(base.compradores, candidata.compradores) * PESOS.compradores),
    sector: base.sector && base.sector === candidata.sector ? PESOS.sector : 0,
    problema: Math.round(jaccard(base.problema, candidata.problema) * PESOS.problema),
  };

  const similitud = Math.min(100, Object.values(componentes).reduce((total, valor) => total + valor, 0));
  return { similitud, componentes, categoriasComunes: categorias.comunes, tagsComunes };
}

// Traduce la comparación a una recomendación. La regla es explícita
// para poder defenderla ante la organización: se busca lo que una
// tiene y la otra no, porque eso es lo que hace viable una unión
// temporal o un consorcio.
function leerRelacion(base, candidata, similitud) {
  const aportes = [];
  if (candidata.capacidades.rup && !base.capacidades.rup) aportes.push('RUP vigente');
  if (candidata.capacidades.experienciaPublica && !base.capacidades.experienciaPublica) {
    aportes.push('experiencia contractual pública acreditada');
  }
  if (candidata.capacidades.capacidadFinanciera && !base.capacidades.capacidadFinanciera) {
    aportes.push('capacidad financiera para respaldar garantías');
  }
  if (candidata.capacidades.cobertura === 'nacional' && base.capacidades.cobertura !== 'nacional') {
    aportes.push('cobertura nacional');
  }

  const mismoTerritorio = Boolean(base.departamento)
    && normalizar(base.departamento) === normalizar(candidata.departamento);

  if (aportes.length > 0) {
    return {
      tipo_relacion: 'complementaria',
      posible_alianza: `Alianza de complemento: ${candidata.nombre} aporta ${aportes.join(', ')}, que es justamente lo que hoy limita a su organización para competir sola.`,
      oportunidad_conjunta: mismoTerritorio
        ? `Unión temporal o consorcio en procesos del mismo territorio (${candidata.departamento}), donde ambas ya operan.`
        : 'Unión temporal o consorcio para acreditar en conjunto los requisitos habilitantes que ninguna cumple por separado.',
    };
  }

  if (similitud >= 70) {
    return {
      tipo_relacion: 'competencia_directa',
      posible_alianza: `Perfil muy cercano al suyo: ${candidata.nombre} compite por los mismos procesos con capacidades equivalentes.`,
      oportunidad_conjunta: 'Conviene diferenciar la propuesta de valor o repartirse territorios antes que enfrentarse en el mismo proceso; una oferta conjunta solo tiene sentido en contratos de mayor cuantía.',
    };
  }

  return {
    tipo_relacion: 'oferta_integrada',
    posible_alianza: `${candidata.nombre} atiende al mismo comprador público con una oferta distinta a la suya.`,
    oportunidad_conjunta: mismoTerritorio
      ? `Oferta integrada ante las entidades de ${candidata.departamento}: un mismo problema público resuelto de extremo a extremo.`
      : 'Oferta integrada ante un mismo tipo de entidad: dos capacidades distintas que resuelven el mismo problema público de extremo a extremo.',
  };
}

/**
 * Compara la organización diagnosticada contra el ecosistema registrado.
 *
 * @param {object} base perfil comparable de la organización diagnosticada
 * @param {Array} candidatas perfiles comparables del resto del ecosistema
 * @param {object} opciones
 * @param {number} opciones.limite máximo de relaciones a devolver
 * @param {number} opciones.umbral similitud mínima para reportar
 * @returns {{organizaciones: Array, evaluadas: number, nota: string|null}}
 */
export function calcularRelacionesEmpresariales(base, candidatas = [], { limite = 5, umbral = 30 } = {}) {
  const organizaciones = candidatas
    .filter((candidata) => candidata && candidata.empresaId !== base.empresaId)
    .map((candidata) => {
      const { similitud, componentes, categoriasComunes, tagsComunes } = compararPar(base, candidata);
      const relacion = leerRelacion(base, candidata, similitud);
      return {
        empresa_id: candidata.empresaId,
        nombre: candidata.nombre,
        tipo_organizacion: candidata.tipoOrganizacion,
        territorio: [candidata.ciudad, candidata.departamento].filter(Boolean).join(', ') || null,
        nivel_madurez: candidata.nivelMadurez,
        similitud,
        componentes,
        categorias_comunes: categoriasComunes.slice(0, 4).map((c) => c.nombre).filter(Boolean),
        tags_comunes: tagsComunes.slice(0, 6),
        ...relacion,
      };
    })
    .filter((relacion) => relacion.similitud >= umbral)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, limite);

  return {
    organizaciones,
    evaluadas: candidatas.length,
    nota: organizaciones.length === 0
      ? 'Todavía no hay organizaciones comparables en el ecosistema IDEAPRO con afinidad suficiente. A medida que la red crezca, aquí aparecerán aliados potenciales para uniones temporales y ofertas conjuntas.'
      : null,
  };
}

export const _internal = { jaccard, afinidadCompartida, terminosDeContenido, mapaDeTags, normalizar, PESOS };
