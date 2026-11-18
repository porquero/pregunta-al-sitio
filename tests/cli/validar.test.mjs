// validar: reglas de estructura fijas y reglas de estilo configurables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNodos, validarSitio, reglasDe, contarPalabras } from '../../cli/validar.mjs';
import { parsearNodo } from '../../cli/contenido/leer.mjs';
import { FIXTURE_PLAYA } from '../../cli/evaluacion/datos.mjs';

test('el contenido de Playa no tiene errores ni avisos', () => {
  const { errores, avisos, nodos } = validarSitio(FIXTURE_PLAYA);
  assert.equal(nodos.length, 37);
  assert.deepEqual(errores, []);
  assert.deepEqual(avisos, []);
});

const palabras = (n) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');

function nodo(id, campos = {}) {
  const d = {
    id, tipo: 'faq', titulo: `Nodo ${id}`, respuesta_corta: palabras(45), estado: 'aprobado',
    preguntas: Array.from({ length: 6 }, (_, i) => `¿Pregunta ${i} de ${id}?`), ...campos,
  };
  const yaml = Object.entries(d).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return { ...parsearNodo(`---\n${yaml}\n---\n${campos.cuerpo ?? ''}`), archivo: `${id}.md` };
}

const contacto = () => nodo('contacto');

test('un sitio correcto con los valores por defecto pasa sin errores', () => {
  const r = validarNodos([nodo('a'), contacto()]);
  assert.deepEqual(r, { errores: [], avisos: [] });
});

test('reglas de estructura', () => {
  const { errores, avisos } = validarNodos([
    nodo('Mal_Id'),
    nodo('a'),
    nodo('b', { estado: 'listo', formato: 'raro' }),
    nodo('c', { respuesta_corta: 'corta', preguntas: ['una'] }),
    nodo('d', { chips: [{ texto: 'Ir', a: 'nada' }, { texto: 'Yo', a: 'd' }], aristas: [{ a: 'nada' }, { a: 'contacto', tipo: 'otro', peso: 2 }] }),
    nodo('e', { enlace: 'http://inseguro.cl', faq: [{ pregunta: 'sin respuesta' }] }),
    { ...nodo('f'), archivo: 'otro.md' },
    { ...nodo('a'), archivo: 'a-copia.md' },
    contacto(),
  ]);
  const hay = (re) => assert.ok(errores.some((e) => re.test(e)), `falta ${re}\n${errores.join('\n')}`);
  hay(/^Mal_Id: id inválido/);
  hay(/^b: estado 'listo' inválido/);
  hay(/^b: formato 'raro' inválido/);
  hay(/^c: respuesta_corta tiene 1 palabras \(40 a 60\)/);
  hay(/^c: tiene 1 preguntas \(mínimo 6\)/);
  hay(/^d: chip 'Ir' hacia 'nada', que no existe/);
  hay(/^d: chip 'Yo' hacia sí mismo/);
  hay(/^d: arista hacia 'nada', que no existe/);
  hay(/^d: arista con tipo 'otro' inválido/);
  hay(/^d: arista hacia 'contacto' con peso 2/);
  hay(/^e: enlace 'http:\/\/inseguro.cl' debe ser https/);
  hay(/^e: faq #1 sin pregunta o respuesta/);
  hay(/^a: id duplicado/);
  assert.ok(avisos.some((a) => /^f: el archivo se llama otro\.md/.test(a)));
});

test('avisa si falta el nodo contacto', () => {
  assert.match(validarNodos([nodo('a')]).avisos[0], /no hay un nodo con id "contacto"/);
});

test('reglas de estilo configurables', () => {
  const sitio = {
    validar: {
      respuesta: { palabras_min: 1, palabras_max: 5, nombrar: 'Acme', nombrar_salvo: ['saludo'] },
      preguntas: { min: 1, max: 2 },
      tipos: ['faq', 'saludo'],
      reglas: [
        { patron: 'gratis', nivel: 'error', mensaje: 'promete gratuidad' },
        { patron: 'Ojo', sensible: true, nivel: 'aviso', campo: 'respuesta', mensaje: 'dice Ojo' },
        { patron: '([', mensaje: 'roto' },
      ],
    },
  };
  const { errores, avisos } = validarNodos([
    nodo('a', { respuesta_corta: 'Acme lo hace', preguntas: ['¿1?'] }),
    nodo('b', { respuesta_corta: 'Lo hacemos', preguntas: ['¿1?', '¿2?', '¿3?'] }),
    nodo('hola', { tipo: 'saludo', respuesta_corta: 'Hola Ojo', preguntas: ['¿1?'] }),
    nodo('c', { tipo: 'otro', respuesta_corta: 'Acme ojo', preguntas: ['¿1?'], cuerpo: 'Es gratis.' }),
    nodo('contacto', { respuesta_corta: 'Acme', preguntas: ['¿1?'] }),
  ], sitio);
  assert.deepEqual(errores.sort(), [
    "c: promete gratuidad",
    "c: tipo 'otro' inválido",
    errores.find((e) => e.startsWith('sitio.yaml: regla con patrón inválido "(["')),
  ].sort());
  assert.deepEqual(avisos.sort(), [
    'b: respuesta_corta no nombra a Acme',
    'b: tiene 3 preguntas (se recomiendan hasta 2)',
    'hola: dice Ojo',
  ].sort());
});

test('la marca de pendiente es error en un aprobado y aviso en un borrador', () => {
  const a = nodo('a', { respuesta_corta: `${palabras(44)} [REDACTAR cifra]` });
  const b = nodo('b', { estado: 'borrador', cuerpo: '[REDACTAR] y [REDACTAR]' });
  const r = validarNodos([a, b, contacto()]);
  assert.deepEqual(r.errores, ['a: aprobado con 1 [REDACTAR]']);
  assert.deepEqual(r.avisos, ['b: 2 [REDACTAR] pendiente(s)']);
});

test('valores por defecto y conteo de palabras', () => {
  assert.equal(reglasDe({ validar: { respuesta: { palabras_max: 80 } } }).respuesta.palabras_min, 40);
  assert.equal(contarPalabras('  una   dos\ntres '), 3);
  assert.equal(contarPalabras(''), 0);
});
