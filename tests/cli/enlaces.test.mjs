// Enlaces entre nodos: sintaxis [texto](nodo:id), autoenlace, validar y clic en el widget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { enLinea, crearAutoenlace, textoVisible } from '../../cli/contenido/html.mjs';
import { parsearNodo, nombresEnlazables } from '../../cli/contenido/leer.mjs';
import { construirIndice } from '../../cli/build.mjs';
import { validarNodos } from '../../cli/validar.mjs';
import { evaluar } from '../../cli/evaluacion/evaluar.mjs';
import { FIXTURE_PLAYA, cargarPreguntas } from '../../cli/evaluacion/datos.mjs';
import { accionDeClic } from '../../src/widget/acciones.js';

const NODO = (id, etiqueta) => `<a href="#" role="button" data-nodo="${id}">${etiqueta}</a>`;

test('[texto](nodo:id) abre el nodo; sin destino queda como texto', () => {
  assert.equal(enLinea('Ver [Hotel Casona Distante](nodo:casona-distante).'), `Ver ${NODO('casona-distante', 'Hotel Casona Distante')}.`);
  assert.equal(enLinea('[A & "b"](nodo:x)'), NODO('x', 'A &amp; &quot;b&quot;'));
  assert.equal(enLinea('Ver [la casona](nodo:casona)', { existe: () => false }), 'Ver la casona');
  assert.equal(enLinea('[malo](nodo:No_Valido)'), 'malo', 'id inválido: no es enlace');
  assert.equal(textoVisible('Ver [Hotel Casona](nodo:casona) y [web](https://e.cl/a/b)'), 'Ver Hotel Casona y web');
});

const nombres = [
  { nombre: 'Hotel Casona Distante', id: 'casona', enlace: null },
  { nombre: 'Casona', id: 'casona', enlace: null },
  { nombre: 'Casona Distante Tours', id: 'tours', enlace: 'https://tours.cl' },
  { nombre: 'Distante', id: 'pueblo', enlace: '/pueblo' },
  { nombre: 'Café', id: 'cafe', enlace: null },
];
const auto = (texto, opciones = {}, id = 'otro') => enLinea(texto, { autoenlace: crearAutoenlace({ nombres, ...opciones }), id });

test('autoenlace sin distinguir tildes ni mayúsculas, solo palabras completas', () => {
  assert.equal(auto('Un CAFE y un café.'), `Un ${NODO('cafe', 'CAFE')} y un café.`);
  assert.equal(auto('Cafetería sin enlace'), 'Cafetería sin enlace');
});

test('autoenlace: solo la primera mención y nunca el propio nodo', () => {
  assert.equal(auto('Casona aquí, casona allá'), `${NODO('casona', 'Casona')} aquí, casona allá`);
  assert.equal(auto('La Casona y el café', {}, 'casona'), `La Casona y el ${NODO('cafe', 'café')}`);
});

test('autoenlace: no toca enlaces, negrita, cursiva ni código', () => {
  assert.equal(auto('[la Casona](/x) y **Casona** y `Café` e *café*'), '<a href="/x">la Casona</a> y <strong>Casona</strong> y <code>Café</code> e <em>café</em>');
  // Si el nodo ya tiene un enlace nodo: a mano, el autoenlace no lo repite.
  assert.equal(auto('[ver](nodo:casona) la Casona'), `${NODO('casona', 'ver')} la Casona`);
});

test('autoenlace: gana el nombre más largo', () => {
  assert.equal(auto('El Hotel Casona Distante'), `El ${NODO('casona', 'Hotel Casona Distante')}`);
  assert.equal(
    auto('Casona Distante Tours sale de Distante'),
    '<a href="https://tours.cl" target="_blank" rel="noopener">Casona Distante Tours</a> sale de ' + NODO('pueblo', 'Distante'),
  );
});

test('autoenlace: destino según enlace y autoenlazar_destino', () => {
  const tours = '<a href="https://tours.cl" target="_blank" rel="noopener">Casona Distante Tours</a>';
  assert.equal(auto('Casona Distante Tours'), tours, 'enlace https: externo');
  assert.equal(auto('Casona Distante Tours', { destino: 'nodo' }), NODO('tours', 'Casona Distante Tours'));
  assert.equal(auto('Distante'), NODO('pueblo', 'Distante'), 'enlace relativo: abre el nodo');
  assert.equal(auto('Distante', { destino: 'enlace' }), '<a href="/pueblo">Distante</a>');
  assert.equal(auto('Casona', { destino: 'enlace' }), NODO('casona', 'Casona'), 'sin enlace: abre el nodo');
});

test('autoenlace: máximo por respuesta', () => {
  assert.equal(auto('Casona, café y Distante', { max: 2 }), `${NODO('casona', 'Casona')}, ${NODO('cafe', 'café')} y Distante`);
  assert.equal(crearAutoenlace({ nombres: [] }), null);
});

test('nombres enlazables: título hasta la coma, alias y sinónimos con +', () => {
  const n = parsearNodo('---\nid: casona\ntipo: t\ntitulo: Hotel Casona, en la playa\nrespuesta_corta: x\nalias: [La Casona]\nsinonimos: [+Casona Distante, hospedaje]\n---\n');
  assert.deepEqual(nombresEnlazables(n), ['Hotel Casona', 'La Casona', 'Casona Distante']);
  assert.deepEqual(n.sinonimos, ['Casona Distante', 'hospedaje'], 'el + no llega al buscador');
});

const nodo = (id, extra = {}) => ({
  id, tipo: 't', titulo: id, formato: 'texto', variante: null, tarjeta: {}, cuerpo: '', faq: [],
  respuestaCorta: Array(45).fill('palabra').join(' '), preguntas: Array(6).fill('¿?'), keywords: [], sinonimos: [],
  alias: [], sinonimosEnlazables: [], aristas: [], chips: [], enChat: true, enlace: null, estado: 'borrador', archivo: `${id}.md`, ...extra,
});

test('validar: enlaces nodo: rotos, ocultos o hacia sí mismo', () => {
  const texto = (enlace) => `${Array(44).fill('palabra').join(' ')} ${enlace}`;
  const { errores } = validarNodos([
    nodo('contacto'),
    nodo('oculto', { enChat: false }),
    nodo('a', { respuestaCorta: texto('[ver](nodo:zeta) [x](nodo:oculto) [y](nodo:a) [z](nodo:contacto)') }),
  ]);
  assert.deepEqual(errores, ["a: enlace hacia 'zeta', que no existe", "a: enlace hacia 'oculto', que no está en el chat", 'a: enlace hacia sí mismo']);
});

test('validar cuenta las palabras visibles, no las URL', () => {
  const r = Array(39).fill('palabra').join(' ') + ' [dos palabras](https://ejemplo.cl/una/ruta/larga)';
  assert.deepEqual(validarNodos([nodo('contacto'), nodo('a', { respuestaCorta: r })]).errores, []);
  const corta = Array(38).fill('palabra').join(' ') + ' [una](https://e.cl/x)';
  assert.deepEqual(validarNodos([nodo('contacto'), nodo('a', { respuestaCorta: corta })]).errores, ['a: respuesta_corta tiene 39 palabras (40 a 60)']);
});

test('con Playa, autoenlazar cambia solo las respuestas: mismas métricas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-enl-'));
  cpSync(FIXTURE_PLAYA, dir, { recursive: true });
  const sin = construirIndice(dir).indice;
  const sitio = parse(readFileSync(join(dir, 'sitio.yaml'), 'utf8'));
  writeFileSync(join(dir, 'sitio.yaml'), stringify({ ...sitio, autoenlazar: true }));
  const con = construirIndice(dir).indice;

  const sinRespuesta = (i) => i.nodos.map(({ respuesta, ...n }) => n);
  assert.deepEqual(sinRespuesta(con), sinRespuesta(sin));
  assert.ok(con.nodos.some((n) => n.respuesta.includes('data-nodo="') && n.respuesta.includes('role="button"')), 'hay autoenlaces');
  const crecimiento = JSON.stringify(con).length / JSON.stringify(sin).length;
  assert.ok(crecimiento < 1.1, `el índice creció ${((crecimiento - 1) * 100).toFixed(1)} %`);

  const consultas = cargarPreguntas(join(dir, 'preguntas.yaml'));
  const metricas = (i) => { const s = evaluar(i, consultas); return { a: s.ajuste, v: s.validacion }; };
  assert.deepEqual(metricas(con), metricas(sin));
});

test('widget: clic en a[data-nodo] abre el nodo y cancela la navegación', () => {
  const elemento = (tagName, dataset, texto) => {
    const el = { tagName, dataset, textContent: ` ${texto} ` };
    return { closest: (sel) => (sel.includes(`${tagName.toLowerCase()}[data-${Object.keys(dataset)[0]}]`) ? el : null) };
  };
  assert.deepEqual(accionDeClic(elemento('A', { nodo: 'casona' }, 'Hotel Casona')), { tipo: 'nodo', valor: 'casona', etiqueta: 'Hotel Casona', enlace: true });
  assert.deepEqual(accionDeClic(elemento('BUTTON', { nodo: 'casona' }, 'Casona')), { tipo: 'nodo', valor: 'casona', etiqueta: 'Casona', enlace: false });
  assert.deepEqual(accionDeClic(elemento('BUTTON', { q: '¿Precio?' }, '¿Precio?')).tipo, 'consulta');
  assert.equal(accionDeClic({ closest: () => null }), null);
});
