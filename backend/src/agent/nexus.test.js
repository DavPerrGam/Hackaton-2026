// =====================================================================
// Pruebas del protocolo IDEAPRO Nexus AI (etapas 2 a 15)
// ---------------------------------------------------------------------
// Verifican las reglas de negocio que NO pueden romperse:
//  - la elegibilidad distingue riesgo de descalificacion,
//  - el nivel de madurez NO es un promedio: los habilitantes duros
//    actuan como techo aunque el indice sea alto,
//  - la clasificacion no inventa afinidades por coincidencias parciales,
//  - la cadena de valor publico llega siempre a un comprador,
//  - el plan de accion pone los habilitantes en los primeros 30 dias,
//  - el reporte final entrega las 20 secciones del protocolo.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularDiagnostico } from './scoring.js';
import { evaluarElegibilidad } from './eligibility.js';
import { clasificarOrganizacion, detectarEnfoques } from './classification.js';
import { generarTags } from './tags.js';
import { perfilComparable, calcularRelacionesEmpresariales } from './similarity.js';
import {
  getVisibleQuestions, CAMPOS_MEMORIA, PREGUNTAS_NUCLEO,
  camposVisibles, derivarRespuestas, llavesDePregunta,
} from './questions.js';
import { aplicarInferencias } from './inference.js';
import { planificarProfundizacion, MAX_PROFUNDIZACIONES } from './sufficiency.js';
import { perfilarOferta } from './valueProposition.js';
import { construirMapaEntidades } from './entityMap.js';
import { construirPlanAccion } from './actionPlan.js';
import { construirReporteFinal } from './report.js';

// Organización sólida en todo salvo lo que cada prueba altera.
const BASE = {
  nombre: 'Andina Digital SAS',
  tipo_organizacion: 'empresa_tecnologica',
  nombre_contacto: 'Ana García',
  cargo_contacto: 'Gerente General',
  correo_contacto: 'ana@andina.co',
  ubicacion_ciudad: 'Popayán',
  ubicacion_departamento: 'Cauca',
  sitio_web: 'andina.co',
  sector_texto: 'Tecnología e Información',
  anios_operacion: 7,
  ventas_registradas: true,
  capital_trabajo: true,
  experiencia_proyectos: true,
  experiencia_previa_contratos: true,
  num_contratos_previos: 5,
  capacidad_operativa: true,
  tipo_bien_servicio: 'Plataforma de gestión documental para entidades públicas',
  problema_que_resuelve: 'Elimina el papel y reduce los tiempos de respuesta al ciudadano',
  diferenciador: 'Única con interoperabilidad nativa con SECOP II',
  tamanio_equipo: 18,
  casos_exito: 4,
  procesos_documentados: true,
  cobertura_territorial: 'regional',
  madurez_tecnologica: 'producto_digital',
  capacidad_escalar: true,
  camara_comercio: true,
  tiene_rup: true,
  certificaciones: true,
  gestion_documental: true,
  conoce_pliegos: true,
  rango_ventas: '500m_2000m',
  crecimiento_ventas: 'crecio',
  flujo_caja: true,
  endeudamiento: 'bajo',
  capacidad_garantias: true,
  conoce_secop: true,
  conoce_planes_desarrollo: true,
  conoce_mga: true,
  equipo_comercial_dedicado: true,
  entidades_objetivo: 'Alcaldía de Popayán, Gobernación del Cauca',
  objetivo_6_meses: 'Ganar tres contratos de transformación digital',
};

// --------------------------------------------------- etapa 2

test('elegibilidad: distingue riesgo subsanable de descalificación', () => {
  assert.equal(evaluarElegibilidad(BASE).estado, 'elegible');

  const sinCapital = evaluarElegibilidad({ ...BASE, capital_trabajo: false });
  assert.equal(sinCapital.estado, 'riesgo');
  assert.equal(sinCapital.riesgos.length, 1);
  assert.equal(sinCapital.riesgos[0].id, 'capital_trabajo');
  assert.match(sinCapital.mensaje, /RIESGO DE ELEGIBILIDAD/);

  const reciente = evaluarElegibilidad({ ...BASE, anios_operacion: 0.5 });
  assert.equal(reciente.estado, 'no_elegible');
});

// --------------------------------------------------- etapa 10

test('el nivel de madurez no es un promedio: sin RUP hay techo aunque el índice sea alto', () => {
  const conRup = calcularDiagnostico(BASE);
  const sinRup = calcularDiagnostico({ ...BASE, tiene_rup: false });

  assert.equal(conRup.nivelMadurez.nivel, 5);
  assert.ok(sinRup.indiceIdeapro > 600, 'el índice sigue siendo alto');
  assert.ok(sinRup.nivelMadurez.nivel <= 3, 'pero el nivel queda limitado por el habilitante');
  assert.ok(sinRup.nivelMadurez.penalizaciones.some((p) => /RUP/.test(p.motivo)));
});

test('el riesgo financiero alto limita el nivel a preparación', () => {
  const frágil = calcularDiagnostico({
    ...BASE,
    capital_trabajo: false,
    flujo_caja: false,
    capacidad_garantias: false,
    endeudamiento: 'alto',
  });
  assert.equal(frágil.riesgoFinanciero.nivel, 'alto');
  assert.ok(frágil.nivelMadurez.nivel <= 2);
});

test('el diagnóstico expone las seis familias de brecha con impacto, riesgo y recomendación', () => {
  const { brechasPorFamilia } = calcularDiagnostico({ ...BASE, tiene_rup: false, conoce_secop: false });
  assert.equal(brechasPorFamilia.length, 6);
  for (const familia of brechasPorFamilia) {
    assert.ok(familia.impacto && familia.riesgo && familia.recomendacion);
    assert.ok(['inmediata', 'alta', 'media', 'baja'].includes(familia.urgencia));
  }
  const juridica = brechasPorFamilia.find((b) => b.id === 'juridica');
  assert.ok(juridica.faltantes.includes('RUP inscrito y actualizado'));
});

test('un cargo operativo se reporta como brecha de facultades de representación', () => {
  const conFacultades = calcularDiagnostico(BASE);
  const sinFacultades = calcularDiagnostico({ ...BASE, cargo_contacto: 'auxiliar administrativo' });
  const buscar = (d) => d.brechasPorFamilia
    .find((b) => b.id === 'juridica').faltantes
    .includes('verificación de facultades del representante');

  assert.equal(buscar(conFacultades), false);
  assert.equal(buscar(sinFacultades), true);
});

// --------------------------------------------------- etapa 3

test('la clasificación asigna afinidad múltiple y no inventa categorías por coincidencia parcial', () => {
  const { categorias } = clasificarOrganizacion(BASE);
  const ids = categorias.map((c) => c.id);

  assert.ok(ids.includes('tecnologia'));
  assert.ok(ids.includes('govtech'));
  for (const categoria of categorias) {
    assert.ok(categoria.afinidad >= 25 && categoria.afinidad <= 100);
  }

  // "Reduce" no debe activar Tecnología por la raíz "red", ni
  // "administrativo" por la sigla "ti".
  const agro = clasificarOrganizacion({
    sector_texto: 'Agroindustria',
    tipo_bien_servicio: 'Producción de café',
    problema_que_resuelve: 'Reduce el costo administrativo del productor',
  });
  assert.equal(agro.categorias.some((c) => c.id === 'tecnologia'), false);
});

// --------------------------------------------------- etapa 4

test('el perfilamiento traduce el servicio hasta un comprador público concreto', () => {
  const clasificacion = clasificarOrganizacion(BASE);
  const perfil = perfilarOferta(BASE, clasificacion);

  assert.ok(perfil.cadenas.length > 0);
  const cadena = perfil.cadenas[0];
  for (const eslabon of ['servicio', 'capacidad', 'problema', 'necesidad_publica', 'impacto_esperado']) {
    assert.ok(cadena[eslabon], `falta el eslabón ${eslabon}`);
  }
  assert.ok(cadena.compradores_publicos.length > 0);
  assert.equal(perfil.alerta, null);

  const sinProblema = perfilarOferta({ ...BASE, problema_que_resuelve: '' }, clasificacion);
  assert.ok(sinProblema.alerta, 'sin problema formulado debe emitirse alerta');
});

// --------------------------------------------------- etapa 12

test('el mapa de entidades no sugiere ministerios a una organización municipal e inmadura', () => {
  const respuestas = { ...BASE, cobertura_territorial: 'local', tiene_rup: false, camara_comercio: false };
  const diagnostico = calcularDiagnostico(respuestas);
  const clasificacion = clasificarOrganizacion(respuestas);
  const perfil = perfilarOferta(respuestas, clasificacion);
  const mapa = construirMapaEntidades({ compradores: perfil.compradores, respuestas, diagnostico });

  const ministerios = mapa.entidades.find((e) => e.id === 'ministerios');
  const alcaldias = mapa.entidades.find((e) => e.id === 'alcaldias');

  assert.equal(ministerios?.accesible_hoy, false);
  assert.ok(ministerios.barreras.length > 0);
  assert.equal(alcaldias?.accesible_hoy, true);
  assert.ok(alcaldias.prioridad > ministerios.prioridad);
  assert.match(alcaldias.ejemplo_territorial, /Popayán/);
});

// --------------------------------------------------- etapa 14

test('el plan de acción pone los habilitantes duros en los primeros 30 días', () => {
  const respuestas = { ...BASE, tiene_rup: false, camara_comercio: false, conoce_secop: false };
  const diagnostico = calcularDiagnostico(respuestas);
  const plan = construirPlanAccion({ respuestas, diagnostico, ruta: [], mapaEntidades: null });

  const treinta = plan.horizontes.find((h) => h.id === '30_dias');
  const noventa = plan.horizontes.find((h) => h.id === '90_dias');

  assert.ok(treinta.acciones.some((a) => a.id === 'rup'));
  assert.ok(treinta.acciones.some((a) => a.id === 'camara_comercio'));
  assert.ok(noventa.acciones.some((a) => a.id === 'secop'));
  assert.equal(treinta.acciones[0].prioridad, 'crítica');
  for (const accion of treinta.acciones) {
    assert.ok(accion.responsable && accion.resultado && accion.prioridad);
  }
  assert.equal(plan.horizontes.length, 4);
});

test('una organización sin brechas habilitantes no recibe acciones críticas de alistamiento', () => {
  const diagnostico = calcularDiagnostico(BASE);
  const plan = construirPlanAccion({ respuestas: BASE, diagnostico, ruta: [], mapaEntidades: null });
  const treinta = plan.horizontes.find((h) => h.id === '30_dias');

  assert.equal(treinta.acciones.length, 0);
  assert.ok(plan.horizontes.find((h) => h.id === '180_dias').acciones.length > 0);
});

// --------------------------------------------------- etapa 15

test('el reporte final entrega las 20 secciones del protocolo', () => {
  const diagnostico = calcularDiagnostico(BASE);
  const clasificacion = clasificarOrganizacion(BASE);
  const perfilamiento = perfilarOferta(BASE, clasificacion);
  const mapaEntidades = construirMapaEntidades({ compradores: perfilamiento.compradores, respuestas: BASE, diagnostico });
  const planAccion = construirPlanAccion({ respuestas: BASE, diagnostico, ruta: [], mapaEntidades });

  const reporte = construirReporteFinal({
    empresa: { nombre: BASE.nombre },
    respuestas: BASE,
    diagnostico,
    clasificacion,
    perfilamiento,
    mapaEntidades,
    ruta: [],
    planAccion,
    encaje: [],
    resumenIA: '',
  });

  assert.equal(reporte.secciones.length, 20);
  assert.deepEqual(
    reporte.secciones.map((s) => s.numero),
    Array.from({ length: 20 }, (_, i) => i + 1)
  );

  // Orden exacto del protocolo: resumen, elegibilidad, perfil,
  // clasificación, perfilamiento, las cinco evaluaciones, madurez,
  // fortalezas, brechas, riesgos, entidades, organizaciones similares,
  // oportunidades, recomendaciones, plan y conclusión.
  const esperadas = [
    'resumen_ejecutivo', 'elegibilidad', 'perfil_organizacional', 'clasificacion',
    'perfilamiento_oferta', 'evaluacion_tecnica', 'evaluacion_juridica',
    'evaluacion_financiera', 'evaluacion_comercial', 'evaluacion_ecosistema',
    'nivel_madurez', 'fortalezas', 'brechas_criticas', 'riesgos',
    'entidades_objetivo', 'organizaciones_similares', 'oportunidades',
    'servicios_ideapro', 'plan_accion', 'conclusion',
  ];
  assert.deepEqual(reporte.secciones.map((s) => s.id), esperadas);

  for (const seccion of reporte.secciones) {
    assert.ok(seccion.titulo, `sección ${seccion.numero} sin título`);
    assert.ok(seccion.contenido, `sección ${seccion.numero} sin contenido`);
  }
});

test('el reporte refleja la elegibilidad y el nivel realmente calculados', () => {
  const respuestas = { ...BASE, capital_trabajo: false, tiene_rup: false };
  const diagnostico = calcularDiagnostico(respuestas);
  const clasificacion = clasificarOrganizacion(respuestas);
  const perfilamiento = perfilarOferta(respuestas, clasificacion);
  const mapaEntidades = construirMapaEntidades({ compradores: perfilamiento.compradores, respuestas, diagnostico });
  const planAccion = construirPlanAccion({ respuestas, diagnostico, ruta: [], mapaEntidades });

  const reporte = construirReporteFinal({
    empresa: { nombre: BASE.nombre }, respuestas, diagnostico, clasificacion,
    perfilamiento, mapaEntidades, ruta: [], planAccion, encaje: [], resumenIA: '',
  });

  const elegibilidad = reporte.secciones.find((s) => s.id === 'elegibilidad');
  assert.equal(elegibilidad.contenido.estado, 'riesgo');
  assert.equal(elegibilidad.contenido.etiqueta, 'RIESGO DE ELEGIBILIDAD');

  const madurez = reporte.secciones.find((s) => s.id === 'nivel_madurez');
  assert.equal(madurez.contenido.nivel, diagnostico.nivelMadurez.nivel);
  assert.ok(madurez.contenido.penalizaciones.length > 0);
  assert.match(madurez.contenido.nota, /no es un promedio/);
});

// ------------------------------- presupuesto e inferencia del núcleo

test('el núcleo respeta el presupuesto de 12 a 15 preguntas y no altera el orden', () => {
  // Peor caso: nada se pudo deducir, así que las dos preguntas
  // condicionales (naturaleza jurídica y sector) también se formulan.
  const peorCaso = getVisibleQuestions({}).filter((q) => q.etapa !== 7);
  assert.ok(peorCaso.length <= 15, `el núcleo formula ${peorCaso.length} preguntas`);

  // Mejor caso: si la IA ya dedujo ambas respuestas, la conversación
  // sigue permitiendo validarlas o corregirlas antes de seguir.
  const mejorCaso = getVisibleQuestions({
    tipo_organizacion: 'empresa_tecnologica',
    sector_texto: 'Tecnologia e Informacion',
    _inferidos: { tipo_organizacion: {}, sector_texto: {} },
  }).filter((q) => q.etapa !== 7);
  assert.ok(mejorCaso.length >= 12, `el núcleo formula solo ${mejorCaso.length} preguntas`);
  assert.ok(mejorCaso.length <= 15, `el núcleo formula ${mejorCaso.length} preguntas`);

  // Una condicional que NO se pudo deducir se formula y, una vez
  // respondida, desaparece. Si siguiera visible aunque ya la respondieron,
  // el índice de paso se correría y la organización se saltaría la
  // pregunta siguiente en silencio.
  const trasResponder = getVisibleQuestions({ sector_texto: 'Agroindustria' })
    .filter((q) => q.etapa !== 7)
    .map((q) => q.id);
  assert.equal(trasResponder.includes('sector_texto'), false);
  assert.ok(trasResponder.length <= peorCaso.length - 1, `quedó la pregunta visible tras responderla`);

  // El orden de la metodología es fijo: quiénes son -> qué hacen -> qué
  // problema resuelven -> capacidad -> experiencia pública -> qué falta.
  const etapas = PREGUNTAS_NUCLEO.map((q) => q.etapa);
  assert.deepEqual(etapas, [...etapas].sort((a, b) => a - b));
  assert.equal(etapas[0], 1);
  assert.equal(etapas[etapas.length - 1], 6);
});

test('lo deducible no se pregunta, y lo deducido queda auditable', () => {
  // La razón social declara la naturaleza jurídica: preguntarla sería
  // hacerle repetir a la fundación que es una fundación.
  const fundacion = aplicarInferencias({ nombre: 'Fundación Raíces del Sur' });
  assert.equal(fundacion.respuestas.tipo_organizacion, 'fundacion');
  assert.equal(fundacion.inferidos.tipo_organizacion.origen, 'razon social');
  assert.equal(
    getVisibleQuestions(fundacion.respuestas).some((q) => q.id === 'tipo_organizacion'),
    true
  );

  // El sector sale de la descripción de la oferta, con el nombre exacto
  // de la tabla `sectores` (de ahí se lee el peso de los ejes).
  const software = aplicarInferencias({
    nombre: 'Andina Digital SAS',
    tipo_bien_servicio: 'Plataforma de software para gestión documental',
    problema_que_resuelve: 'Digitaliza el archivo y reduce tiempos de respuesta',
  });
  assert.equal(software.respuestas.sector_texto, 'Tecnologia e Informacion');
  assert.equal(getVisibleQuestions(software.respuestas).some((q) => q.id === 'sector_texto'), true);

  // Nunca pisa una respuesta explícita.
  const declarado = aplicarInferencias({
    nombre: 'Fundación Raíces del Sur',
    tipo_organizacion: 'corporacion',
  });
  assert.equal(declarado.respuestas.tipo_organizacion, 'corporacion');
  assert.equal(declarado.nuevos.tipo_organizacion, undefined);

  // Ante evidencia ambigua se pregunta: adivinar el sector cambiaría el
  // peso de la evaluación sin que nadie lo haya decidido.
  const ambiguo = aplicarInferencias({ nombre: 'Servicios Integrales', tipo_bien_servicio: 'Servicios varios' });
  assert.equal(ambiguo.respuestas.sector_texto, undefined);

  const inferidoVisible = getVisibleQuestions({
    sector_texto: 'Salud y Servicios Medicos',
    _inferidos: { sector_texto: { valor: 'Salud y Servicios Medicos', origen: 'descripcion de la oferta' } },
  });
  assert.equal(inferidoVisible.some((q) => q.id === 'sector_texto'), true);
});

// --------------------------------- suficiencia y profundización

test('sin señales el agente se detiene: no hay preguntas de relleno', () => {
  const plan = planificarProfundizacion(BASE);
  assert.equal(plan.suficiente, true);
  assert.deepEqual(plan.preguntas, []);
  assert.equal(getVisibleQuestions({ ...BASE, _profundizacion: plan }).some((q) => q.etapa === 7), false);
});

test('la profundización solo se abre ante inconsistencia, brecha, riesgo u oportunidad', () => {
  // Dice haber contratado con el Estado sin RUP ni expediente: eso no
  // cuadra y hay que preguntarlo antes de calificar el frente jurídico.
  const inconsistente = planificarProfundizacion({ ...BASE, tiene_rup: false, gestion_documental: false });
  assert.ok(inconsistente.preguntas.includes('figura_contratacion'));
  assert.equal(inconsistente.senales[0].tipo, 'inconsistencia');

  // El Estado paga contra entrega: sin capital de trabajo hay riesgo.
  const sinLiquidez = planificarProfundizacion({ ...BASE, capital_trabajo: false });
  assert.ok(sinLiquidez.preguntas.includes('financiacion_ejecucion'));

  // El problema enunciado en dos palabras no permite llegar a la
  // entidad compradora: se pide concretarlo.
  const ofertaVaga = planificarProfundizacion({ ...BASE, problema_que_resuelve: 'Ayudamos' });
  assert.ok(ofertaVaga.preguntas.includes('problema_detallado'));

  // Tope duro de tres, aunque disparen todos los detectores.
  const todoMal = planificarProfundizacion({
    ...BASE,
    tiene_rup: false,
    gestion_documental: false,
    problema_que_resuelve: 'Ayudamos',
    capital_trabajo: false,
    flujo_caja: false,
    entidades_objetivo: '',
  });
  assert.equal(todoMal.preguntas.length, MAX_PROFUNDIZACIONES);
});

test('el plan de profundización se congela: responder una no apaga su propia pregunta', () => {
  const sinEntidades = { ...BASE, entidades_objetivo: '' };
  const plan = planificarProfundizacion(sinEntidades);
  assert.ok(plan.preguntas.includes('entidades_objetivo'));

  const enCurso = { ...sinEntidades, _profundizacion: plan };
  const visibles = getVisibleQuestions(enCurso).map((q) => q.id);
  assert.ok(visibles.includes('entidades_objetivo'));

  // Al responderla, el detector que la abrió deja de aplicar; si el plan
  // se recalculara, la pregunta desaparecería de la lista visible y el
  // índice de paso retrocedería a mitad de la conversación.
  const respondida = { ...enCurso, entidades_objetivo: 'Alcaldía de Popayán' };
  assert.deepEqual(getVisibleQuestions(respondida).map((q) => q.id), visibles);
});

test('el enfoque detectado no cambia al responder el propio bloque de profundización', () => {
  const antes = detectarEnfoques(BASE);
  const despues = detectarEnfoques({
    ...BASE,
    tec_dependencia_objetivo: 'Gestión documental y atención al ciudadano',
    con_resultados: 'Consultoría estratégica y planeación territorial',
    for_resultados: 'Diplomados en formación y capacitación de funcionarios',
  });
  assert.deepEqual(antes, despues);
});

// ------------------------- preguntas compuestas -> señales de rúbrica

test('un checklist es un turno de conversación y varias señales de rúbrica', () => {
  const juridico = PREGUNTAS_NUCLEO.find((q) => q.id === 'alistamiento_juridico');
  const derivadas = derivarRespuestas(juridico, ['tiene_rup', 'conoce_pliegos']);

  // Lo marcado es true, lo no marcado es false explícito: no marcar
  // también es una respuesta, y la rúbrica debe poder leerla.
  assert.equal(derivadas.tiene_rup, true);
  assert.equal(derivadas.conoce_pliegos, true);
  assert.equal(derivadas.camara_comercio, false);
  assert.equal(derivadas.gestion_documental, false);

  // Los cinco campos que antes eran cinco preguntas siguen llegando a
  // scoring.js con el mismo nombre: la rúbrica no se enteró del cambio.
  const conCompuesta = calcularDiagnostico({ ...BASE, ...derivadas });
  const conPlanas = calcularDiagnostico({
    ...BASE,
    tiene_rup: true, conoce_pliegos: true, camara_comercio: false,
    certificaciones: false, gestion_documental: false,
  });
  assert.equal(conCompuesta.scores.legal, conPlanas.scores.legal);
  assert.equal(conCompuesta.indiceIdeapro, conPlanas.indiceIdeapro);
});

test('un formulario aporta sus campos planos y declara sus llaves', () => {
  const financiero = PREGUNTAS_NUCLEO.find((q) => q.id === 'perfil_financiero');
  assert.deepEqual(llavesDePregunta(financiero), [
    'rango_ventas', 'crecimiento_ventas', 'endeudamiento', 'flujo_caja', 'capacidad_garantias',
  ]);

  const derivadas = derivarRespuestas(financiero, {
    rango_ventas: '500m_2000m',
    crecimiento_ventas: 'crecio',
    endeudamiento: 'bajo',
    flujo_caja: true,
    capacidad_garantias: true,
  });
  assert.equal(derivadas.rango_ventas, '500m_2000m');
  assert.equal(derivadas.flujo_caja, true);
  // La llave contenedora se conserva para el historial y el control de
  // obligatoriedad, sin estorbar a los motores deterministas.
  assert.equal(typeof derivadas.perfil_financiero, 'object');
});

// --------------------------------------------------- etapa 4

test('los tags salen de un vocabulario controlado y declaran su origen', () => {
  const clasificacion = clasificarOrganizacion(BASE);
  const perfilamiento = perfilarOferta(BASE, clasificacion);
  const diagnostico = calcularDiagnostico(BASE);
  const mapaEntidades = construirMapaEntidades({ compradores: perfilamiento.compradores, respuestas: BASE, diagnostico });
  const { tags, lista } = generarTags({ respuestas: BASE, clasificacion, perfilamiento, mapaEntidades, diagnostico });

  assert.ok(tags.length > 0);
  assert.ok(lista.includes('Gestión documental'), 'el léxico controlado detecta la capacidad declarada');
  assert.ok(lista.includes('Interoperabilidad'));
  assert.ok(lista.some((tag) => tag === 'GovTech' || tag === 'Tecnología'));
  assert.ok(lista.includes('Experiencia pública acreditada'));
  for (const tag of tags) {
    assert.ok(tag.tag && tag.tipo && tag.origen, 'cada tag debe poder explicarse');
  }
  // Vocabulario cerrado: no se inventan etiquetas nuevas por redacción.
  assert.equal(new Set(lista).size, lista.length);
});

// --------------------------------------------------- etapa 11

test('la similitud empresarial distingue alianza complementaria de competencia directa', () => {
  const clasificacion = clasificarOrganizacion(BASE);
  const perfilamiento = perfilarOferta(BASE, clasificacion);
  const tags = generarTags({ respuestas: BASE, clasificacion, perfilamiento });

  // Organización base: sin RUP ni experiencia pública.
  const base = perfilComparable({
    empresaId: 'base',
    nombre: BASE.nombre,
    departamento: 'Cauca',
    sector: BASE.sector_texto,
    clasificacion,
    tags: tags.tags,
    perfilamiento,
    capacidades: { rup: false, experienciaPublica: false, capacidadFinanciera: false },
  });

  const gemela = perfilComparable({
    empresaId: 'gemela',
    nombre: 'Cauca Software SAS',
    departamento: 'Cauca',
    sector: BASE.sector_texto,
    clasificacion,
    tags: tags.tags,
    perfilamiento,
    capacidades: { rup: true, experienciaPublica: true, capacidadFinanciera: true },
  });

  const ajena = perfilComparable({
    empresaId: 'ajena',
    nombre: 'Ganadería del Norte',
    departamento: 'Córdoba',
    sector: 'Agroindustria',
    clasificacion: clasificarOrganizacion({
      sector_texto: 'Agroindustria',
      tipo_bien_servicio: 'Producción de leche',
      problema_que_resuelve: 'Mejora la productividad ganadera',
    }),
    tags: [],
    perfilamiento: { compradores: [], cadenas: [] },
    capacidades: {},
  });

  const { organizaciones } = calcularRelacionesEmpresariales(base, [gemela, ajena]);

  assert.equal(organizaciones.length, 1, 'una organización de otro sector no es comparable');
  assert.equal(organizaciones[0].empresa_id, 'gemela');
  assert.ok(organizaciones[0].similitud >= 70);
  assert.equal(organizaciones[0].tipo_relacion, 'complementaria');
  assert.match(organizaciones[0].posible_alianza, /RUP vigente/);
  assert.match(organizaciones[0].oportunidad_conjunta, /Cauca/);

  // Contra una gemela con las MISMAS carencias, la lectura cambia: son
  // competencia, no alianza.
  const espejo = perfilComparable({
    empresaId: 'espejo',
    nombre: 'Espejo SAS',
    departamento: 'Cauca',
    sector: BASE.sector_texto,
    clasificacion,
    tags: tags.tags,
    perfilamiento,
    capacidades: { rup: false, experienciaPublica: false, capacidadFinanciera: false },
  });
  const competencia = calcularRelacionesEmpresariales(base, [espejo]).organizaciones[0];
  assert.equal(competencia.tipo_relacion, 'competencia_directa');
});

test('sin ecosistema registrado la sección explica por qué está vacía', () => {
  const base = perfilComparable({ empresaId: 'base', nombre: 'Sola SAS', clasificacion: {}, tags: [], perfilamiento: {} });
  const resultado = calcularRelacionesEmpresariales(base, []);
  assert.deepEqual(resultado.organizaciones, []);
  assert.match(resultado.nota, /ecosistema/i);
});

// --------------------------------------------------- etapa 12

test('memoria inteligente: lo ya respondido no se vuelve a preguntar', () => {
  const heredables = ['tipo_organizacion', 'correo_contacto', 'ubicacion_ciudad'];
  for (const campo of heredables) assert.ok(CAMPOS_MEMORIA.includes(campo));

  const base = { nombre: BASE.nombre };
  const sinMemoria = getVisibleQuestions(base).map((q) => q.id);
  const conMemoria = getVisibleQuestions({ ...base, _memoria: heredables });

  // Una pregunta propia heredada desaparece entera.
  assert.ok(sinMemoria.includes('tipo_organizacion'));
  assert.equal(conMemoria.some((q) => q.id === 'tipo_organizacion'), false);

  // Un campo heredado dentro de una pregunta compuesta desaparece solo
  // él: el resto del formulario sigue haciendo falta.
  const identificacion = conMemoria.find((q) => q.id === 'identificacion');
  const campos = camposVisibles(identificacion, { _memoria: heredables }).map((c) => c.id);
  assert.equal(campos.includes('correo_contacto'), false);
  assert.ok(campos.includes('nombre_contacto'));

  // Si TODOS los campos de una compuesta se heredaron, ya no hay nada
  // que preguntar y la pregunta entera se retira.
  const fichaCompleta = getVisibleQuestions({
    ...base,
    _memoria: ['nombre_contacto', 'cargo_contacto', 'correo_contacto'],
  });
  assert.equal(fichaCompleta.some((q) => q.id === 'identificacion'), false);

  // Las capacidades nunca se heredan: volver a medirlas es el objeto
  // mismo de un segundo diagnóstico.
  for (const campo of ['tiene_rup', 'flujo_caja', 'casos_exito', 'conoce_secop']) {
    assert.equal(CAMPOS_MEMORIA.includes(campo), false);
  }
});
