// Métricas de consultas escritas: qué se envía, la frase de la respuesta y el envío sin credenciales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosConsulta, fraseRespuesta, enviarMetricas, LARGO_TEXTO, LARGO_RESPUESTA } from '../../src/widget/metricas.js';
import { normalizarOpciones, opcionesDeAtributos } from '../../src/widget/opciones.js';

const aqui = { origin: 'https://sitio.cl', pathname: '/tours/', search: '?utm=x', hash: '#a' };

test('opción metricas: data-metricas y sin valor por defecto', () => {
  assert.equal(opcionesDeAtributos({ indice: '/i', metricas: '/pas/registrar.php' }).metricas, '/pas/registrar.php');
  assert.equal(normalizarOpciones({ indice: '/i' }).metricas, null);
  assert.equal(normalizarOpciones({ indice: '/i', metricas: '/m' }).metricas, '/m');
});

test('datos de la consulta: texto sin modificar recortado a 300 y url sin query ni hash', () => {
  const largo = `Mi correo es a@b.cl ${'x'.repeat(400)}`;
  const d = datosConsulta(largo, aqui);
  assert.deepEqual(Object.keys(d), ['texto', 'url'], 'nada más: ni sesión ni agente');
  assert.equal(d.texto.length, LARGO_TEXTO);
  assert.ok(d.texto.startsWith('Mi correo es a@b.cl'), 'la limpieza la hace el servidor');
  assert.equal(d.url, 'https://sitio.cl/tours/');
});

test('frase de la respuesta: título, opciones, conocimiento general, derivada o sin respuesta', () => {
  const porId = new Map([['a', { titulo: 'Tour a la isla' }], ['b', { titulo: 'Tour al valle' }]]);
  assert.equal(fraseRespuesta({ tipo: 'nodo', ref: 'a' }, {}, porId), 'Tour a la isla');
  assert.equal(fraseRespuesta({ tipo: 'opciones', ref: ['a', 'b'] }, {}, porId), 'Opciones: Tour a la isla | Tour al valle');
  assert.equal(fraseRespuesta({ tipo: 'mixta', ref: { nodo: 'b', texto: 'q' } }, {}, porId), 'Conocimiento general: Tour al valle');
  assert.equal(fraseRespuesta({ tipo: 'contacto', ref: {} }, { ambito: 'general' }, porId), 'Sin respuesta');
  assert.equal(fraseRespuesta({ tipo: 'contacto', ref: {} }, { ambito: 'derivar' }, porId), 'Derivada a contacto');
  assert.equal(fraseRespuesta({ tipo: 'nodo', ref: 'z' }, {}, porId), 'z', 'sin el nodo: su id');
  const largo = new Map([['a', { titulo: 'x'.repeat(300) }]]);
  assert.equal(fraseRespuesta({ tipo: 'nodo', ref: 'a' }, {}, largo).length, LARGO_RESPUESTA);
});

test('envío con sendBeacon y un Blob application/json', async () => {
  const enviados = [];
  const navegador = { sendBeacon: (url, blob) => (enviados.push({ url, blob }), true) };
  let fetchLlamado = false;
  enviarMetricas('/m', { texto: 'hola', url: 'https://sitio.cl/', respuesta: 'Sin respuesta' }, { navegador, fetch: () => (fetchLlamado = true) });
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].url, '/m');
  assert.equal(enviados[0].blob.type, 'application/json');
  assert.deepEqual(JSON.parse(await enviados[0].blob.text()), { texto: 'hola', url: 'https://sitio.cl/', respuesta: 'Sin respuesta' });
  assert.equal(fetchLlamado, false);
});

test('sin sendBeacon (o si lo rechaza): fetch con keepalive y sin credenciales', () => {
  for (const navegador of [{}, { sendBeacon: () => false }, { sendBeacon: () => { throw new TypeError('no'); } }]) {
    const pedidos = [];
    enviarMetricas('/m', { texto: 'hola' }, { navegador, fetch: (url, init) => (pedidos.push({ url, init }), Promise.resolve()) });
    assert.equal(pedidos.length, 1);
    const { init } = pedidos[0];
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.keepalive, true);
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), { texto: 'hola' });
  }
});

test('fallo silencioso: errores de red, de fetch o sin fetch no lanzan', async () => {
  const rechazo = Promise.reject(new Error('red'));
  assert.doesNotThrow(() => enviarMetricas('/m', { texto: 'x' }, { navegador: {}, fetch: () => rechazo }));
  assert.doesNotThrow(() => enviarMetricas('/m', { texto: 'x' }, { navegador: {}, fetch: () => { throw new Error('x'); } }));
  assert.doesNotThrow(() => enviarMetricas('/m', { texto: 'x' }, { navegador: undefined, fetch: undefined }));
  await new Promise((ok) => setTimeout(ok, 0)); // El rechazo no queda sin atender.
});
