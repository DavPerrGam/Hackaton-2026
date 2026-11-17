import test from 'node:test';
import assert from 'node:assert/strict';
import { identificarOportunidadesReales } from './opportunityMatch.js';

test('prioriza oportunidades compatibles y explica requisitos faltantes', () => {
  const resultado = identificarOportunidadesReales(
    { scores: { oferta: 90, experiencia: 70 } },
    [
      {
        id: 'compatible',
        fuente: 'manual',
        nombre: 'Suministro compatible',
        territorio: 'Bogota',
        estado: 'abierta',
        fecha_cierre: '2099-01-01T00:00:00Z',
        requisitos: {
          sectores: ['tecnologia'],
          productos_servicios: ['software'],
          requisitos_por_eje: { oferta: 70 },
          documentos: ['rup'],
        },
      },
      {
        id: 'vencida',
        fuente: 'manual',
        nombre: 'Oportunidad vencida',
        estado: 'abierta',
        fecha_cierre: '2020-01-01T00:00:00Z',
        requisitos: {},
      },
    ],
    {
      sector_texto: 'Tecnologia e Informacion',
      tipo_bien_servicio: 'Desarrollo de software',
      territorio: 'Bogota',
      documentos: [],
    },
    {},
    new Date('2026-09-08T00:00:00Z')
  );

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].oportunidad.id, 'compatible');
  assert.equal(resultado[0].porcentajeEncaje, 85);
  assert.equal(resultado[0].brechas[0].faltantes[0], 'rup');
  assert.equal(resultado[0].accionRecomendada, 'Cerrar las brechas prioritarias y revisar requisitos antes de postular');
});

test('descarta oportunidades vencidas o incompatibles', () => {
  const resultado = identificarOportunidadesReales(
    { scores: { oferta: 80 } },
    [
      { id: 'vencida', estado: 'abierta', fecha_cierre: '2020-01-01T00:00:00Z', requisitos: {} },
      { id: 'territorio', estado: 'abierta', territorio: 'Medellin', requisitos: {} },
    ],
    { sector_texto: 'Tecnologia', territorio: 'Bogota', tipo_bien_servicio: 'Software' },
    {},
    new Date('2026-09-08T00:00:00Z')
  );

  assert.deepEqual(resultado, []);
});

test('filtra tipos de oportunidad por sector aplicable', async () => {
  const { calcularEncajeOportunidades } = await import('./opportunityMatch.js');
  const resultado = calcularEncajeOportunidades(
    { scores: { oferta: 80, legal: 80 } },
    [
      { id: 'ti', sectores_aplicables: ['Tecnologia e Informacion'], requisitos_por_eje: { oferta: 40 } },
      { id: 'salud', sectores_aplicables: ['Salud y Servicios Medicos'], requisitos_por_eje: { oferta: 40 } },
    ],
    'Tecnologia e Informacion'
  );
  assert.deepEqual(resultado.map((item) => item.oportunidad.id), ['ti']);
});

test('considera totalmente compatible un tipo sin requisitos de eje', async () => {
  const { calcularEncajeOportunidades } = await import('./opportunityMatch.js');
  const resultado = calcularEncajeOportunidades({ scores: {} }, [{ id: 'abierta', requisitos_por_eje: {} }]);
  assert.equal(resultado[0].porcentajeEncaje, 100);
});
