import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDiagnostico } from './scoring.js';

test('calcula dimensiones, madurez y brechas de forma explicable', () => {
  const resultado = calcularDiagnostico({
    sector_texto: 'Tecnologia e Informacion',
    tipo_bien_servicio: 'Software empresarial',
    diferenciador: 'Implementacion especializada para entidades publicas',
    anios_operacion: 5,
    experiencia_previa_contratos: true,
    num_contratos_previos: 4,
    certificaciones: true,
    tamanio_equipo: 8,
    procesos_documentados: true,
    tiene_rup: true,
    conoce_pliegos: true,
    rango_ventas: '500m_2000m',
    capacidad_garantias: true,
    equipo_comercial_dedicado: true,
    conoce_secop: true,
  });

  assert.equal(Object.keys(resultado.scores).length, 6);
  assert.ok(resultado.indiceIdeapro >= 0 && resultado.indiceIdeapro <= 1000);
  assert.ok(['exploracion', 'preparacion', 'lista_para_explorar', 'preparada', 'consolidada'].includes(resultado.nivelMadurezGlobal));
  assert.equal(resultado.dimensionesIdeapro.juridica_documental, resultado.scores.legal);
  assert.ok(Array.isArray(resultado.brechas));
});
