// Forma del set de evaluación del fixture de Playa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarIndice, cargarPreguntas, particion } from '../../cli/evaluacion/datos.mjs';

const ids = new Set(cargarIndice().nodos.map((n) => n.id));
const consultas = cargarPreguntas();
const cuenta = (f) => consultas.filter(f).length;

test('tamaño y composición mínimos', () => {
  assert.ok(consultas.length >= 150, `${consultas.length} consultas`);
  assert.ok(cuenta((c) => c.tipo === 'general') >= 30, 'al menos 30 de conocimiento general');
  assert.ok(cuenta((c) => c.tipo === 'general' && c.frontera) >= 15, 'al menos 15 generales de frontera');
  assert.ok(cuenta((c) => c.tipo === 'necesidad') >= 15, 'al menos 15 de necesidad propia');
  assert.ok(cuenta((c) => c.tipo === 'ajena') >= 10, 'al menos 10 ajenas o sin sentido');
});

test('cada esperado y cada contexto es un nodo del chat', () => {
  for (const c of consultas) {
    for (const id of c.esperado) assert.ok(ids.has(id), `${c.consulta}: ${id} no existe`);
    if (c.contexto) assert.ok(ids.has(c.contexto), `${c.consulta}: contexto ${c.contexto} no existe`);
  }
});

test('las generales esperan solo contacto', () => {
  for (const c of consultas.filter((x) => x.tipo === 'general')) assert.deepEqual(c.esperado, ['contacto'], c.consulta);
});

test('sin consultas repetidas', () => {
  const vistas = new Set();
  for (const c of consultas) {
    assert.ok(!vistas.has(c.consulta), `repetida: ${c.consulta}`);
    vistas.add(c.consulta);
  }
});

test('la partición es cercana a 60/40 en cada tipo', () => {
  const { ajuste, validacion } = particion(consultas);
  assert.equal(ajuste.length + validacion.length, consultas.length);
  const proporcion = ajuste.length / consultas.length;
  assert.ok(proporcion > 0.57 && proporcion < 0.63, `ajuste ${proporcion}`);
});
