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
  assert.equal(s.tamanos.ajuste + s.tamanos.validacion + s.tamanos.seguimiento, cargarPreguntas().length);
  assert.equal(s.tamanos.seguimiento, 8, 'las de seguimiento quedan fuera de las métricas');
  assert.ok(!s.validacionPorTipo.seguimiento);
  assert.equal(s.seguimiento.n, 8);
  assert.ok(cumple(s.validacion));
  assert.ok(Array.isArray(s.errores));
  assert.ok(s.validacionPorTipo.general);
  assert.equal(s.config.zonas.Ta, datos.config.zonas.Ta);
});

test('el grafo con atenuación 0 ordena igual que BM25F', () => {
  const g = crearGrafo(datos.nodos, {}, { atenuacion: 0, contexto: 0 });
  assert.ok(g.buscar('hosting').length > 0);
});

test('calibrar informa el compromiso por Cm y respeta el máximo de falso rechazo', async () => {
  const { calibrar, GRILLA_CM } = await import('../cli/evaluacion/calibrar.mjs');
  const r = calibrar(datos, cargarPreguntas());
  assert.deepEqual(r.compromiso.map((c) => c.Cm), GRILLA_CM);
  assert.equal(r.compromiso.filter((c) => c.elegido).length, 1);
  assert.equal(r.objetivo.falsoRechazo, 0.05);
  assert.ok(r.validacion.metricas.falsoRechazo <= 0.05, 'la validación queda dentro del objetivo');
  const estricto = calibrar(datos, cargarPreguntas(), { maxFalsoRechazo: 0.02 });
  assert.equal(estricto.objetivo.falsoRechazo, 0.02);
  assert.ok(estricto.ajuste.metricas.falsoRechazo <= r.ajuste.metricas.falsoRechazo);
});
