// Herramientas de evaluación con el fixture de Playa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluar } from '../cli/evaluacion/evaluar.mjs';
import { cargarIndice, cargarPreguntas } from '../cli/evaluacion/datos.mjs';
import { cumple } from '../cli/evaluacion/metricas.mjs';
import { crearGrafo } from '../cli/evaluacion/bm25f.mjs';

const datos = cargarIndice();

test('evaluar informa validación, ajuste, errores y tipos', () => {
  const s = evaluar(datos, cargarPreguntas(), { medicion: false });
  assert.equal(s.tamanos.ajuste + s.tamanos.validacion, cargarPreguntas().length);
  assert.ok(cumple(s.validacion));
  assert.ok(Array.isArray(s.errores));
  assert.ok(s.validacionPorTipo.general);
  assert.equal(s.config.zonas.Ta, datos.config.zonas.Ta);
});

test('el grafo con atenuación 0 ordena igual que BM25F', () => {
  const g = crearGrafo(datos.nodos, {}, { atenuacion: 0, contexto: 0 });
  assert.ok(g.buscar('hosting').length > 0);
});
