import test from 'node:test';
import assert from 'node:assert/strict';
import { construirRutaRecomendada } from './recommendation.js';

test('ordena el eje crítico y agrega prerrequisitos obligatorios', () => {
  const ruta = construirRutaRecomendada({
    diagnostico: {
      indiceIdeapro: 650,
      nivelMadurezGlobal: 'preparada',
      ejeCritico: 'legal',
      scores: { legal: 35, oferta: 50, experiencia: 70, operativa: 70, financiera: 70, comercial: 70 },
    },
    catalogo: [
      { id: 'legal', eje_relacionado: 'legal', nombre_servicio: 'Estructuración legal', orden_catalogo: 1, indice_minimo: 0 },
      { id: 'oferta', eje_relacionado: 'oferta', nombre_servicio: 'Ajuste de oferta', orden_catalogo: 2, indice_minimo: 0 },
    ],
    dependencias: [],
  });

  assert.equal(ruta[0].servicio_id, 'legal');
  assert.equal(ruta[0].orden_prioridad, 1);
});
