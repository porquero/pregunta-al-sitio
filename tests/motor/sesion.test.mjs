// Sesión del chat (sesion.js) sobre un almacenamiento de prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearSesion, filtrarEventos } from '../../src/motor/sesion.js';
import { CLAVE_SESION } from '../../src/motor/config.js';

function almacen(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
    datos,
  };
}

test('guarda eventos {t, tipo, ref} bajo la clave versionada', () => {
  const a = almacen();
  const s = crearSesion(a, { reloj: () => 42 });
  s.agregar('usuario', 'Hola');
  s.agregar('nodo', 'inicio');
  assert.deepEqual(s.cargar(), [{ t: 42, tipo: 'usuario', ref: 'Hola' }, { t: 42, tipo: 'nodo', ref: 'inicio' }]);
  assert.ok(a.datos.has(CLAVE_SESION));
  assert.match(CLAVE_SESION, /\.v\d+$/);
});

test('borrar elimina la conversación', () => {
  const a = almacen();
  const s = crearSesion(a);
  s.agregar('nodo', 'inicio');
  s.borrar();
  assert.deepEqual(s.cargar(), []);
  assert.equal(a.datos.size, 0);
});

test('conserva solo los eventos más recientes', () => {
  const s = crearSesion(almacen(), { max: 3 });
  for (const id of ['a', 'b', 'c', 'd']) s.agregar('nodo', id);
  assert.deepEqual(s.cargar().map((e) => e.ref), ['b', 'c', 'd']);
});

test('ignora datos corruptos, de otra forma o tipos desconocidos', () => {
  assert.deepEqual(crearSesion(almacen({ [CLAVE_SESION]: '{no es json' })).cargar(), []);
  assert.deepEqual(crearSesion(almacen({ [CLAVE_SESION]: '{"eventos":"x"}' })).cargar(), []);
  const mezclado = JSON.stringify({ eventos: [{ t: 1, tipo: 'nodo', ref: 'a' }, { t: 2, tipo: 'raro', ref: 'b' }, { tipo: 'nodo', ref: 'c' }] });
  assert.deepEqual(crearSesion(almacen({ [CLAVE_SESION]: mezclado })).cargar(), [{ t: 1, tipo: 'nodo', ref: 'a' }]);
});

test('funciona sin almacenamiento o con uno que falla', () => {
  const sinAlmacen = crearSesion(null);
  sinAlmacen.agregar('nodo', 'a');
  assert.deepEqual(sinAlmacen.cargar(), []);
  const lleno = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => { throw new Error('x'); } };
  const s = crearSesion(lleno);
  assert.doesNotThrow(() => s.agregar('nodo', 'a'));
  assert.doesNotThrow(() => s.borrar());
});

test('al restaurar se descartan los ids que ya no existen', () => {
  const existe = (id) => ['a', 'b'].includes(id);
  const eventos = [
    { t: 1, tipo: 'usuario', ref: 'hola' },
    { t: 2, tipo: 'nodo', ref: 'a' },
    { t: 3, tipo: 'nodo', ref: 'borrado' },
    { t: 4, tipo: 'opciones', ref: ['b', 'borrado'] },
    { t: 5, tipo: 'opciones', ref: ['x', 'y'] },
    { t: 6, tipo: 'mixta', ref: { nodo: 'borrado', texto: 'q' } },
    { t: 7, tipo: 'contacto', ref: { texto: 'q', derivado: true } },
  ];
  assert.deepEqual(filtrarEventos(eventos, existe).map((e) => [e.t, e.ref]), [
    [1, 'hola'], [2, 'a'], [4, ['b']], [7, { texto: 'q', derivado: true }],
  ]);
});
