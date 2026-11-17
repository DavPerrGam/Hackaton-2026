import test from 'node:test';
import assert from 'node:assert/strict';

import { QUESTIONS } from './questions.js';
import {
  MAX_ANIOS_OPERACION,
  construirEntrevista,
  esRespuestaNoPertinente,
  generarRespuestaDiagnosticoLocal,
  validarValor,
} from '../services/agentService.js';
import {
  esConfianzaValida,
  esRespuestaConfiable,
  respuestaTieneEvidenciaNumerica,
} from './n8nChat.js';

const GARBAGE = 'quiero pizza';

function camposDePreguntas() {
  return QUESTIONS.flatMap((pregunta) => (
    pregunta.type === 'form'
      ? pregunta.campos.map((campo) => ({ ...campo, prompt: campo.label }))
      : [pregunta]
  ));
}

test('rechaza respuestas ajenas en texto, textarea y select', () => {
  for (const pregunta of camposDePreguntas()) {
    if (['text', 'textarea', 'select'].includes(pregunta.type)) {
      assert.equal(
        esRespuestaNoPertinente(pregunta, GARBAGE),
        true,
        `La pregunta ${pregunta.id} aceptó una respuesta ajena`
      );
    }
  }
});

test('rechaza respuestas que no tienen relación con el contexto de la pregunta', () => {
  const preguntaProducto = QUESTIONS.find((item) => item.id === 'tipo_bien_servicio');
  const preguntaNaturaleza = QUESTIONS.find((item) => item.id === 'tipo_organizacion');

  assert.equal(esRespuestaNoPertinente(preguntaProducto, 'me gusta jugar fútbol y ver series'), true);
  assert.equal(esRespuestaNoPertinente(preguntaNaturaleza, 'quiero aprender a cocinar'), true);
  assert.equal(esRespuestaNoPertinente(preguntaProducto, 'vendemos software para gestión documental'), false);
});

test('permite respuestas relacionadas aunque no usen palabras clave rígidas del contexto', () => {
  const preguntaProducto = QUESTIONS.find((item) => item.id === 'tipo_bien_servicio');
  const respuesta = 'Nos dedicamos a conectar a los usuarios con su ciudad a través de una SuperApp que integra servicios de entrega a domicilio de restaurantes, supermercados y farmacias';

  assert.equal(esRespuestaNoPertinente(preguntaProducto, respuesta), false);
});

test('rechaza respuestas vagas o evasivas como "no sé" o "depende"', () => {
  const preguntaProducto = QUESTIONS.find((item) => item.id === 'tipo_bien_servicio');
  const preguntaCierre = QUESTIONS.find((item) => item.id === 'cierre');

  assert.equal(esRespuestaNoPertinente(preguntaProducto, 'no sé'), true);
  assert.equal(esRespuestaNoPertinente(preguntaCierre, 'depende'), true);
  assert.equal(esRespuestaNoPertinente(preguntaProducto, 'vendemos software para gestión documental'), false);
});

test('rechaza cargos genericos como "si soy" y antigüedad menor a un año con días', () => {
  const preguntaCargo = { id: 'cargo_contacto', type: 'text', prompt: '¿Cuál es tu cargo?' };
  const preguntaAntiguedad = QUESTIONS.find((item) => item.id === 'anios_operacion');

  assert.throws(
    () => validarValor(preguntaCargo, 'si soy'),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => validarValor(preguntaAntiguedad, '2 dias'),
    (error) => error.statusCode === 403 || error.statusCode === 400
  );
});

test('rechaza "yo" como nombre de organización', () => {
  const pregunta = QUESTIONS.find((item) => item.id === 'nombre');

  assert.throws(
    () => validarValor(pregunta, 'yo'),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => validarValor(pregunta, 'aaa'),
    (error) => error.statusCode === 400
  );
});

test('reconstruye preguntas realizadas y respuestas para n8n', () => {
  const entrevista = construirEntrevista(
    { nombre: 'Andina Digital SAS', anios_operacion: 7, ventas_registradas: true },
    [
      { role: 'agent', step: 'nombre', content: '¿Cuál es el nombre?' },
      { role: 'user', step: 'nombre', content: 'Andina Digital SAS' },
      { role: 'agent', step: 'anios_operacion', content: '¿Cuántos años?' },
      { role: 'user', step: 'anios_operacion', content: '7' },
    ]
  );

  assert.equal(entrevista.preguntas_realizadas.length, 2);
  assert.equal(entrevista.preguntas_realizadas[0].respuesta, 'Andina Digital SAS');
  assert.equal(entrevista.preguntas_realizadas[1].respuesta, 7);
  assert.equal(entrevista.respuestas_completas.ventas_registradas, true);
});

test('rechaza formatos inventados en número y booleano', () => {
  const numero = QUESTIONS.find((pregunta) => pregunta.id === 'anios_operacion');
  const booleano = camposDePreguntas().find((campo) => campo.type === 'boolean');
  const checklist = QUESTIONS.find((pregunta) => pregunta.type === 'multi');

  assert.throws(
    () => validarValor(numero, 'no se sabe'),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => validarValor(booleano, 'tal vez'),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => validarValor(checklist, ['opcion_inventada']),
    (error) => error.statusCode === 400
  );
});

test('rechaza antigüedad menor a un año y mayor al máximo', () => {
  const pregunta = QUESTIONS.find((item) => item.id === 'anios_operacion');

  assert.throws(
    () => validarValor(pregunta, 0.5),
    (error) => error.statusCode === 403
  );
  assert.throws(
    () => validarValor(pregunta, MAX_ANIOS_OPERACION + 1),
    (error) => error.statusCode === 400
  );
  assert.doesNotThrow(() => validarValor(pregunta, 1));
  assert.doesNotThrow(() => validarValor(pregunta, MAX_ANIOS_OPERACION));
});

test('rechaza correo y sitio web inventados, pero permite valores válidos', () => {
  const identificacion = QUESTIONS.find((pregunta) => pregunta.id === 'identificacion');
  const contexto = QUESTIONS.find((pregunta) => pregunta.id === 'contexto_operacion');

  assert.throws(
    () => validarValor(identificacion, {
      nombre_contacto: 'Ana García',
      cargo_contacto: 'Gerente',
      correo_contacto: 'correo inventado',
    }),
    (error) => error.statusCode === 400
  );
  assert.doesNotThrow(() => validarValor(identificacion, {
    nombre_contacto: 'Ana García',
    cargo_contacto: 'Gerente',
    correo_contacto: 'ana@empresa.co',
  }));
  assert.throws(
    () => validarValor(contexto, {
      ubicacion_ciudad: 'Bogotá',
      ubicacion_departamento: 'Cundinamarca',
      sitio_web: 'página inventada',
    }),
    (error) => error.statusCode === 400
  );
});

test('n8n exige confianza numérica válida y evidencia de cifras', () => {
  assert.equal(esConfianzaValida(0.65), true);
  assert.equal(esConfianzaValida('0.65'), false);
  assert.equal(esConfianzaValida(true), false);
  assert.equal(esConfianzaValida(1.1), false);
  assert.equal(esRespuestaConfiable({ reply: 'Respuesta respaldada', confidence: 0.65 }), true);
  assert.equal(esRespuestaConfiable({ reply: 'Respuesta inventada', confidence: 0 }), false);
  assert.equal(respuestaTieneEvidenciaNumerica('La empresa lleva 7 años.', { anios_operacion: 7 }), true);
  assert.equal(respuestaTieneEvidenciaNumerica('La empresa tiene 99 contratos.', { anios_operacion: 7 }), false);
});

test('genera una respuesta contextual cuando falta n8n o el flujo de chat no aporta evidencia', () => {
  const contexto = {
    diagnostico: {
      indiceIdeapro: 865,
      nivelMadurezGlobal: 'maduro',
      nivelMadurezNumero: 4,
      ejeCritico: 'financiero',
      scores: {
        financiera: 76,
        operativa: 82,
        oferta: 87,
      },
      resumen: 'La empresa tiene buena solvencia operativa y un punto crítico financiero.',
      brechas: ['financiero', 'operativo'],
      riesgoFinanciero: 'bajo',
      nivelMadurez: { global: 'maduro', numero: 4 },
      ruta: [{ nombre: 'Fortalecimiento financiero' }],
    },
  };

  const respuesta = generarRespuestaDiagnosticoLocal(contexto, 'Con un puntaje de 865/1000 y nivel de riesgo financiero bajo, me queda claro que tenemos solvencia y músculo operativo.');

  assert.match(respuesta, /865/i);
  assert.match(respuesta, /riesgo financiero/i);
  assert.match(respuesta, /solvencia|operativo|financiero/i);
  assert.doesNotMatch(respuesta, /No puedo afirmar eso/i);
});
