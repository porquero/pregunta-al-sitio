// Máquina de estados del chat (dialogo.js), con un render de prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidir, debeRegistrarse, crearDialogo, LARGO_MAXIMO } from '../../src/motor/dialogo.js';
import { crearResolver } from '../../src/motor/resolver.js';
import { cargarIndice } from '../../cli/evaluacion/datos.mjs';

const datos = cargarIndice();
const r = crearResolver(datos);

test('decidir: una acción por zona', () => {
  assert.deepEqual(decidir({ zona: 'alta', nodos: ['a'] }, 'q'), { tipo: 'nodo', ref: 'a' });
  assert.deepEqual(decidir({ zona: 'media', nodos: ['a', 'b'] }, 'q'), { tipo: 'opciones', ref: ['a', 'b'] });
  assert.deepEqual(decidir({ zona: 'media', nodos: ['a'] }, 'q'), { tipo: 'nodo', ref: 'a' });
  assert.deepEqual(decidir({ zona: 'mixta', nodos: ['a'] }, 'q'), { tipo: 'mixta', ref: { nodo: 'a', texto: 'q' } });
  assert.deepEqual(decidir({ zona: 'baja', nodos: ['contacto'] }, 'q'), { tipo: 'contacto', ref: { texto: 'q', derivado: true } });
});

test('solo se registran como sin respuesta las consultas bajas que no se derivan a propósito', () => {
  assert.equal(debeRegistrarse({ zona: 'baja', ambito: 'neutro', terminos: ['x'] }), true);
  assert.equal(debeRegistrarse({ zona: 'baja', ambito: 'general', terminos: ['x'] }), true);
  assert.equal(debeRegistrarse({ zona: 'baja', ambito: 'derivar', terminos: ['x'] }), false);
  assert.equal(debeRegistrarse({ zona: 'baja', ambito: 'neutro', terminos: [] }), false);
  assert.equal(debeRegistrarse({ zona: 'alta', ambito: 'sitio', terminos: ['x'] }), false);
});

function armar() {
  const dibujado = [];
  const guardado = [];
  const registrados = [];
  const render = Object.fromEntries(
    ['usuario', 'nodo', 'opciones', 'mixta', 'contacto'].map((tipo) => [tipo, async (ref, { animar }) => {
      await new Promise((ok) => setTimeout(ok, tipo === 'usuario' ? 0 : 5));
      dibujado.push({ tipo, ref, animar });
    }]),
  );
  const dialogo = crearDialogo({
    obtenerResolver: async () => r,
    render,
    sesion: { agregar: (tipo, ref) => guardado.push({ tipo, ref }) },
    registrarSinRespuesta: (t) => registrados.push(t),
  });
  return { dialogo, dibujado, guardado, registrados };
}

test('una pregunta de alta confianza muestra el mensaje del usuario y luego el nodo, y queda guardada', async () => {
  const { dialogo, dibujado, guardado } = armar();
  await dialogo.preguntar('  ¿Tienen   hosting con respaldo? ');
  assert.deepEqual(dibujado.map((d) => d.tipo), ['usuario', 'nodo']);
  assert.equal(dibujado[0].ref, '¿Tienen hosting con respaldo?');
  assert.equal(dibujado[1].ref, 'hosting-seguridad-respaldo');
  assert.ok(dibujado.every((d) => d.animar));
  assert.deepEqual(guardado, dibujado.map(({ tipo, ref }) => ({ tipo, ref })));
});

test('el conocimiento general va a contacto con la consulta precargada y se registra como tokens', async () => {
  const { dialogo, dibujado, registrados } = armar();
  await dialogo.preguntar('¿Qué es la Ley 21.719?');
  assert.deepEqual(dibujado[1], { tipo: 'contacto', ref: { texto: '¿Qué es la Ley 21.719?', derivado: true }, animar: true });
  assert.equal(registrados.length, 1);
  assert.ok(registrados[0].every((t) => /^[a-z0-9]+$/.test(t)), 'solo tokens normalizados');
});

test('los temas derivados a propósito no se registran', async () => {
  const { dialogo, dibujado, registrados } = armar();
  await dialogo.preguntar('¿Están contratando?');
  assert.equal(dibujado[1].tipo, 'contacto');
  assert.equal(registrados.length, 0);
});

test('las interacciones se encolan en orden aunque lleguen juntas', async () => {
  const { dialogo, dibujado } = armar();
  dialogo.abrirNodo('metodologia', 'Cómo trabajamos');
  dialogo.escribirAlEquipo('Necesito ayuda');
  await dialogo.preguntar('¿Tienen hosting?');
  assert.deepEqual(dibujado.map((d) => d.tipo), ['usuario', 'nodo', 'usuario', 'contacto', 'usuario', dibujado[5].tipo]);
  assert.deepEqual(dibujado[3].ref, { texto: 'Necesito ayuda', derivado: false });
});

test('una pregunta vacía no hace nada y una larga se recorta', async () => {
  const { dialogo, dibujado } = armar();
  await dialogo.preguntar('   ');
  assert.equal(dibujado.length, 0);
  await dialogo.preguntar('hosting '.repeat(60));
  assert.equal(dibujado[0].ref.length <= LARGO_MAXIMO, true);
});

test('restaurar dibuja sin animación y no vuelve a guardar', async () => {
  const { dialogo, dibujado, guardado } = armar();
  await dialogo.restaurar([{ t: 1, tipo: 'usuario', ref: 'Hola' }, { t: 2, tipo: 'nodo', ref: 'inicio' }]);
  assert.deepEqual(dibujado.map((d) => d.animar), [false, false]);
  assert.equal(guardado.length, 0);
});

test('los chips de los nodos abren un nodo del chat o llevan a una respuesta de confianza alta', () => {
  const ids = new Set(datos.nodos.map((n) => n.id));
  for (const n of datos.nodos) {
    for (const chip of n.chips ?? []) {
      if (typeof chip === 'object') {
        assert.ok(ids.has(chip.a) && chip.a !== n.id, `chip "${chip.texto}" de ${n.id} hacia ${chip.a}`);
        continue;
      }
      const res = r.resolver(chip);
      assert.equal(res.zona, 'alta', `chip "${chip}" de ${n.id}: zona ${res.zona} (${res.nodos.join(', ')})`);
      assert.notEqual(res.nodos[0], n.id, `chip "${chip}" de ${n.id} vuelve al mismo nodo`);
    }
  }
});
