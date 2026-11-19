// Enlaces entre nodos: sintaxis [texto](nodo:id), autoenlace, validar y clic en el widget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { enLinea, crearAutoenlace, textoVisible, crearFiltroUrl, dominiosDe, respuestaHtml } from '../../cli/contenido/html.mjs';
import { parsearNodo, nombresEnlazables } from '../../cli/contenido/leer.mjs';
import { construirIndice } from '../../cli/build.mjs';
import { validarNodos } from '../../cli/validar.mjs';
import { evaluar } from '../../cli/evaluacion/evaluar.mjs';
import { FIXTURE_PLAYA, cargarPreguntas } from '../../cli/evaluacion/datos.mjs';
import { accionDeClic } from '../../src/widget/acciones.js';
import { iniciarSitio } from '../../cli/iniciar.mjs';

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
  assert.equal(auto('Casona Distante Tours sale de Distante'), `${NODO('tours', 'Casona Distante Tours')} sale de ${NODO('pueblo', 'Distante')}`);
});

test('autoenlace: por defecto abre el nodo; con destino enlace, solo enlaces del sitio o texto', () => {
  const url = crearFiltroUrl(['casona.cl']);
  assert.equal(auto('Distante'), NODO('pueblo', 'Distante'), 'por defecto: abre el nodo');
  assert.equal(auto('Distante', { destino: 'enlace', url }), '<a href="/pueblo">Distante</a>');
  assert.equal(auto('Casona Distante Tours', { destino: 'enlace', url }), 'Casona Distante Tours', 'tours.cl no es el sitio: texto, sin href="#"');
  const propio = [{ nombre: 'Tours', id: 'tours', enlace: 'https://www.casona.cl/tours' }];
  assert.equal(enLinea('Tours', { autoenlace: crearAutoenlace({ nombres: propio, destino: 'enlace', url }) }), '<a href="https://www.casona.cl/tours">Tours</a>');
  assert.equal(auto('Casona', { destino: 'enlace', url }), 'Casona', 'sin enlace: texto');
  // Una mención sin destino no gasta el máximo: el siguiente nodo se enlaza.
  assert.equal(auto('Casona y Distante', { destino: 'enlace', url, max: 1 }), 'Casona y <a href="/pueblo">Distante</a>');
  assert.ok(!auto('Casona Distante Tours y Distante', { destino: 'enlace', url }).includes('_blank'));
});

test('sitio: dominios y filtro de URL', () => {
  assert.deepEqual(dominiosDe('misitio.cl'), ['misitio.cl']);
  assert.deepEqual(dominiosDe(['https://www.MiSitio.cl/inicio', '*otro.cl*']), ['misitio.cl', 'otro.cl']);
  assert.deepEqual(dominiosDe(undefined), []);
  const url = crearFiltroUrl(dominiosDe('misitio.cl'));
  for (const ok of ['https://misitio.cl', 'https://www.misitio.cl/a?b=1', 'http://tienda.misitio.cl/x', '/ruta', '#ancla', 'mailto:a@misitio.cl', 'tel:+56900000000']) {
    assert.equal(url(ok), ok, ok);
  }
  for (const no of ['https://otro.cl', 'https://misitio.cl.evil.com', 'https://evil.com/?misitio.cl', 'https://nomisitio.cl', 'javascript:alert(1)']) {
    assert.equal(url(no), null, no);
  }
  assert.equal(crearFiltroUrl([])('https://misitio.cl'), null, 'sin sitio: solo relativos');
});

test('respuesta: los enlaces fuera del sitio se omiten y queda su texto', () => {
  const url = crearFiltroUrl(['misitio.cl']);
  assert.equal(enLinea('Ver [la guía](https://www.misitio.cl/guia) o [wotel](https://wotel.cl).', { url }), 'Ver <a href="https://www.misitio.cl/guia">la guía</a> o wotel.');
  const html = respuestaHtml(
    { id: 'a', titulo: 'A', formato: 'tarjeta', variante: 'servicio', respuestaCorta: 'x', tarjeta: { items: [{ titulo: 'Afuera', ruta: 'https://otro.cl' }], cta: { texto: 'Ir', destino: 'https://otro.cl' } } },
    {},
    { url },
  );
  assert.ok(!html.includes('otro.cl') && html.includes('<dt>Afuera</dt>') && !html.includes('pas-cta'), html);
});

test('build: sin sitio infiere el dominio de los enlace; omitidos se cuentan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-dom-'));
  mkdirSync(join(dir, 'nodos'));
  const md = (id, enlace, texto) => `---\nid: ${id}\ntipo: t\ntitulo: ${id}\nenlace: ${enlace}\nrespuesta_corta: ${texto}\nestado: aprobado\n---\n`;
  writeFileSync(join(dir, 'nodos', 'a.md'), md('a', 'https://misitio.cl/a', 'Ver [web](https://misitio.cl/x) y [ruta](/y).'));
  writeFileSync(join(dir, 'nodos', 'b.md'), md('b', '/b', 'b'));
  const inferido = construirIndice(dir);
  assert.deepEqual(inferido.dominios, ['misitio.cl']);
  assert.match(inferido.avisos[0], /no define sitio: uso misitio\.cl/);
  assert.equal(inferido.indice.nodos[0].enlace, 'https://misitio.cl/a');
  assert.match(inferido.indice.nodos[0].respuesta, /<a href="https:\/\/misitio.cl\/x">web<\/a>/);
  assert.equal(inferido.indice.nodos[1].enlace, '/b');

  writeFileSync(join(dir, 'sitio.yaml'), 'sitio: otro.cl\n');
  const otro = construirIndice(dir);
  assert.equal(otro.indice.nodos[0].enlace, null);
  assert.match(otro.indice.nodos[0].respuesta, /Ver web y <a href="\/y">ruta<\/a>\./);
  assert.equal(otro.omitidos, 2, '"Ver más" y el enlace del texto');
  assert.deepEqual(otro.avisos, []);

  writeFileSync(join(dir, 'sitio.yaml'), 'sitio: "[REDACTAR dominio]"\n');
  assert.deepEqual(construirIndice(dir).dominios, ['misitio.cl'], 'el marcador cuenta como sin sitio');
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

test('validar avisa los enlaces fuera del sitio', () => {
  const texto = `${Array(44).fill('palabra').join(' ')} [web](https://otro.cl/x)`;
  const nodos = [nodo('contacto'), nodo('a', { respuestaCorta: texto, enlace: 'https://misitio.cl/a', tarjeta: { cta: { texto: 'Ir', destino: 'https://otro.cl' } } })];
  assert.deepEqual(validarNodos(nodos, { sitio: 'misitio.cl' }).avisos, [
    "a: enlace 'https://otro.cl/x' fuera del sitio (misitio.cl): se omite",
    "a: enlace 'https://otro.cl' fuera del sitio (misitio.cl): se omite",
  ]);
  // Sin sitio, validar infiere el dominio igual que build y lo avisa.
  const sin = validarNodos(nodos).avisos;
  assert.ok(sin.includes('sitio.yaml: falta sitio (dominio principal); build usará misitio.cl, el más frecuente en los enlace. Escríbelo.'));
  assert.ok(!sin.some((x) => x.includes("'https://misitio.cl/a'")));
});

test('iniciar --sitio escribe el dominio', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'pas-ini-')), 's');
  iniciarSitio(dir, { nombre: 'Acme', sitio: 'acme.cl' });
  assert.equal(parse(readFileSync(join(dir, 'sitio.yaml'), 'utf8')).sitio, 'acme.cl');
  const vacio = join(mkdtempSync(join(tmpdir(), 'pas-ini-')), 's');
  iniciarSitio(vacio);
  assert.match(parse(readFileSync(join(vacio, 'sitio.yaml'), 'utf8')).sitio, /^\[REDACTAR dominio principal/);
});
