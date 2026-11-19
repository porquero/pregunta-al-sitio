// Reglas de validar: claves de tarjeta, aristas y nombres enlazables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNodos, avisosGrafo, avisosAutoenlace } from '../../cli/validar.mjs';
import { parsearNodo } from '../../cli/contenido/leer.mjs';
import { crearFiltroUrl, enLinea, crearAutoenlace } from '../../cli/contenido/html.mjs';
import { construirIndice } from '../../cli/build.mjs';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const nodo = (id, extra = {}) => ({
  id, tipo: 't', titulo: id, formato: 'texto', variante: null, tarjeta: {}, cuerpo: '', faq: [],
  respuestaCorta: Array(45).fill('palabra').join(' '), preguntas: Array(6).fill('¿?'), keywords: [], sinonimos: [],
  alias: [], sinonimosEnlazables: [], autoenlazar: true, aristas: [], chips: [], enChat: true, enlace: null, estado: 'borrador', archivo: `${id}.md`, ...extra,
});
const arista = (a) => ({ a, tipo: 'profundiza', peso: 0.5 });

test('tarjeta: "2,5 horas" sin comillas es error y sugiere entrecomillar', () => {
  const md = `---\nid: tour\ntipo: t\ntitulo: Tour\nrespuesta_corta: x\nformato: tarjeta\ntarjeta:\n  items:\n    - { titulo: Duración, texto: 2,5 horas }\n  cifras: [{ numero: 3, etiqueta: días, valor: 1 }]\n  cta: { texto: Reservar, destino: /reservas, color: rojo }\n---\n`;
  const n = parsearNodo(md);
  assert.deepEqual(n.tarjeta.items[0], { titulo: 'Duración', texto: 2, '5 horas': null }, 'así lo lee YAML');
  const { errores } = validarNodos([nodo('contacto'), { ...nodo('tour'), tarjeta: n.tarjeta, formato: 'tarjeta' }]);
  const de = errores.filter((e) => e.startsWith('tour: tarjeta'));
  assert.equal(de.length, 3);
  assert.match(de[0], /^tour: tarjeta\.items\[0\]: clave '5 horas' desconocida \(se esperan titulo, texto, ruta\); si un valor lleva coma o dos puntos, entrecomíllalo: \{ titulo: A, texto: "2,5 horas" \}/);
  assert.match(de[1], /^tour: tarjeta\.cifras\[0\]: clave 'valor' desconocida/);
  assert.match(de[2], /^tour: tarjeta\.cta: clave 'color' desconocida/);
  const nulo = validarNodos([nodo('contacto'), nodo('b', { tarjeta: { items: [{ titulo: 'A', texto: null }] } })]).errores;
  assert.match(nulo[0], /^b: tarjeta\.items\[0\]: 'texto' sin valor/);
  const bien = validarNodos([nodo('contacto'), nodo('c', { tarjeta: { items: ['texto', { titulo: 'A', texto: '2,5 horas', ruta: '/a' }], cifras: [{ numero: 3, etiqueta: 'días' }], cta: { texto: 'Ir', destino: '/x' } } })]);
  assert.deepEqual(bien.errores, []);
});

test('aristas: recíprocas, una sola saliente y nodos que concentran aristas', () => {
  const nodos = [
    nodo('a', { aristas: [arista('b'), arista('h')] }),
    nodo('b', { aristas: [arista('a'), arista('h')] }),
    nodo('c', { aristas: [arista('h')] }),
    nodo('d', { aristas: [arista('h'), arista('contacto')] }),
    nodo('e', { aristas: [arista('contacto'), arista('a')] }),
    nodo('f', { aristas: [arista('contacto'), arista('a')] }),
    nodo('h', { aristas: [arista('a'), arista('c'), arista('d')] }),
    nodo('contacto'),
  ];
  assert.deepEqual(avisosGrafo(nodos).sort(), [
    "a: arista recíproca con 'b' (cada uno ofrece al otro y los chips rebotan)",
    "a: arista recíproca con 'h' (cada uno ofrece al otro y los chips rebotan)",
    "a: recibe aristas de 4 de 8 nodos (más del 15 %); se ofrecerá como chip en muchas respuestas",
    "c: arista recíproca con 'h' (cada uno ofrece al otro y los chips rebotan)",
    'c: una sola arista saliente (con dos o más los chips varían)',
    "d: arista recíproca con 'h' (cada uno ofrece al otro y los chips rebotan)",
    'h: recibe aristas de 4 de 8 nodos (más del 15 %); se ofrecerá como chip en muchas respuestas',
  ].sort(), 'contacto recibe 3 aristas y no se avisa');
});

test('autoenlace: avisa nombres comunes o muy mencionados; autoenlazar: false los excluye', () => {
  const texto = (extra) => `${Array(40).fill('palabra').join(' ')} ${extra}`;
  const nodos = [
    nodo('seguridad', { titulo: 'Seguridad, respaldo y soporte' }),
    nodo('saludo', { titulo: 'Hola, bienvenida' }),
    nodo('casona', { titulo: 'Hotel Casona Distante' }),
    nodo('excluido', { titulo: 'Soporte, mesa de ayuda', autoenlazar: false }),
    ...Array.from({ length: 11 }, (_, i) => nodo(`x${i}`, { respuestaCorta: texto(i < 3 ? 'la seguridad y el soporte del Hotel Casona Distante' : 'el Hotel Casona Distante') })),
  ];
  const sitio = { autoenlazar: true };
  const avisos = avisosAutoenlace(nodos, sitio, crearFiltroUrl([]));
  assert.ok(avisos.includes("seguridad: el nombre enlazable 'Seguridad' es una palabra común (3 respuestas la usan); cambia el título, quita el alias o usa autoenlazar: false"));
  assert.ok(avisos.some((a) => a.startsWith("saludo: el nombre enlazable 'Hola' es una palabra común (0")), 'palabra vacía del motor');
  assert.ok(avisos.includes("casona: el nombre enlazable 'Hotel Casona Distante' aparece en las respuestas de 11 nodos; cambia el título, quita el alias o usa autoenlazar: false"));
  assert.ok(!avisos.some((a) => a.startsWith('excluido:')));
  assert.deepEqual(avisosAutoenlace(nodos, {}, crearFiltroUrl([])), [], 'sin autoenlazar no avisa');

  const enlace = avisosAutoenlace([nodo('a', { titulo: 'Casona', enlace: '/casona' }), nodo('b', { titulo: 'Refugio Norte', enlace: 'https://otro.cl' })], { autoenlazar: true, autoenlazar_destino: 'enlace' }, crearFiltroUrl(['misitio.cl']));
  assert.deepEqual(enlace, ['b: sin enlace del sitio; con autoenlazar_destino: enlace, sus menciones quedan como texto']);
});

test('build: un nodo con autoenlazar: false no se enlaza en otras respuestas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-auto-'));
  mkdirSync(join(dir, 'nodos'));
  writeFileSync(join(dir, 'sitio.yaml'), 'autoenlazar: true\n');
  const md = (id, titulo, texto, extra = '') => `---\nid: ${id}\ntipo: t\ntitulo: ${titulo}\nrespuesta_corta: ${texto}\nestado: aprobado\n${extra}---\n`;
  writeFileSync(join(dir, 'nodos', 'a.md'), md('a', 'Casona', 'La Casona y el Refugio.'));
  writeFileSync(join(dir, 'nodos', 'b.md'), md('b', 'Refugio', 'x', 'autoenlazar: false\n'));
  writeFileSync(join(dir, 'nodos', 'c.md'), md('c', 'Mirador', 'Desde el Mirador se ve la Casona.'));
  const nodos = construirIndice(dir).indice.nodos;
  assert.match(nodos[0].respuesta, /La Casona y el Refugio\./, 'Refugio queda sin enlace');
  assert.match(nodos[2].respuesta, /data-nodo="a">Casona<\/a>/);
  assert.equal(enLinea('Casona', { autoenlace: crearAutoenlace({ nombres: [] }) }), 'Casona');
});
