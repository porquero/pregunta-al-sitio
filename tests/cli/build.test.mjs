// build: contenido del sitio → indice.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construirIndice } from '../../cli/build.mjs';
import { parsearNodo } from '../../cli/contenido/leer.mjs';
import { enLinea, respuestaHtml, urlSegura } from '../../cli/contenido/html.mjs';
import { cargarIndice, FIXTURE_PLAYA } from '../../cli/evaluacion/datos.mjs';
import { crearResolver } from '../../src/motor/resolver.js';

test('el índice de Playa armado desde sus .md es el del fixture', () => {
  const { indice, errores } = construirIndice(FIXTURE_PLAYA);
  assert.deepEqual(errores, []);
  assert.deepEqual(indice, cargarIndice(), 'vuelve a correr: node cli/bin.mjs build tests/fixtures/playa');
});

test('el índice trae lo que necesitan el motor y el widget', () => {
  const indice = cargarIndice();
  assert.match(indice.version, /^[0-9a-f]{12}$/);
  assert.equal(indice.nombre, 'Playa SPA');
  assert.ok(Object.keys(indice.diccionario).length > 0);
  assert.ok(indice.config.zonas && indice.config.motor);
  assert.match(indice.derivacion, /Este asistente responde sobre Playa SPA/);
  for (const n of indice.nodos) {
    assert.match(n.respuesta, new RegExp(`^<article class="pas-respuesta[^"]*" data-nodo="${n.id}">`), n.id);
    assert.ok(n.seguimiento.length <= 4, n.id);
    for (const s of n.seguimiento) assert.ok(s.texto && (s.nodo || s.q), n.id);
  }
  const hosting = indice.nodos.find((n) => n.id === 'hosting-empresarial');
  assert.equal(hosting.enlace, '/hosting-empresarial');
  assert.match(hosting.respuesta, /<li>Seguridad multicapa y SSL automático<\/li>/);
  assert.deepEqual(hosting.seguimiento.map((s) => s.nodo), ['hosting-seguridad-respaldo', 'infraestructura-cloud', 'contacto']);
});

function sitioTemporal(archivos) {
  const dir = mkdtempSync(join(tmpdir(), 'pas-'));
  mkdirSync(join(dir, 'nodos'));
  for (const [nombre, texto] of Object.entries(archivos)) writeFileSync(join(dir, nombre), texto);
  return dir;
}

const nodo = (id, extra = '') => `---\nid: ${id}\ntipo: faq\ntitulo: Título de ${id}, largo\nrespuesta_corta: Respuesta de ${id}.\npreguntas: [¿Qué es ${id}?]\nestado: aprobado\n${extra}---\nCuerpo.\n`;

test('excluye borradores salvo que se pidan, y los nodos fuera del chat', () => {
  const dir = sitioTemporal({
    'sitio.yaml': 'nombre: Ejemplo\n',
    'nodos/a.md': nodo('a', 'aristas:\n  - { a: b, peso: 0.9 }\n  - { a: c, peso: 0.8 }\n'),
    'nodos/b.md': nodo('b').replace('estado: aprobado', 'estado: borrador'),
    'nodos/c.md': nodo('c', 'publicacion: { chat: false }\n'),
    'nodos/roto.md': 'sin frontmatter',
  });
  const { indice, errores } = construirIndice(dir);
  assert.deepEqual(indice.nodos.map((n) => n.id), ['a']);
  assert.deepEqual(indice.nodos[0].aristas, []);
  assert.equal(errores.length, 1);
  assert.match(errores[0], /roto\.md: falta el frontmatter/);
  const conBorradores = construirIndice(dir, { borradores: true }).indice;
  assert.deepEqual(conBorradores.nodos.map((n) => n.id), ['a', 'b']);
  assert.deepEqual(conBorradores.nodos[0].seguimiento, [{ texto: 'Título de b', nodo: 'b' }]);
  assert.match(conBorradores.nodos[0].respuesta, /<p class="pas-antetitulo">Ejemplo<\/p>/);
  // El índice armado funciona con el resolvedor.
  assert.equal(crearResolver(conBorradores).resolver('¿Qué es b?').nodos[0], 'b');
});

test('la versión cambia con el contenido', () => {
  const a = construirIndice(sitioTemporal({ 'nodos/a.md': nodo('a') })).indice.version;
  const b = construirIndice(sitioTemporal({ 'nodos/a.md': nodo('a', 'keywords: [otra]\n') })).indice.version;
  assert.notEqual(a, b);
});

test('lee el enlace y, por compatibilidad, ruta, pagina_padre y enlace_externo', () => {
  const base = '---\nid: x\ntipo: faq\ntitulo: X\nrespuesta_corta: R\n';
  assert.equal(parsearNodo(`${base}enlace: /x\nruta: /otra\n---\n`).enlace, '/x');
  assert.equal(parsearNodo(`${base}ruta: /x\n---\n`).enlace, '/x');
  assert.equal(parsearNodo(`${base}ruta: /x\npublicacion: { pagina: false }\npagina_padre: /p#x\n---\n`).enlace, '/p#x');
  assert.equal(parsearNodo(`${base}enlace_externo: https://e.cl\n---\n`).enlace, 'https://e.cl');
  assert.equal(parsearNodo(`${base}---\n`).enlace, null);
  assert.throws(() => parsearNodo('---\nid: x\n---\n'), /falta 'tipo'/);
});

test('el HTML escapa el texto y solo deja enlaces seguros', () => {
  assert.equal(enLinea('<b>hola</b> & "chao"'), '&lt;b&gt;hola&lt;/b&gt; &amp; &quot;chao&quot;');
  assert.equal(enLinea('Mira **esto** y *eso* en `código`'), 'Mira <strong>esto</strong> y <em>eso</em> en <code>código</code>');
  assert.equal(enLinea('[contacto](/contacto) y [web](https://e.cl)'), '<a href="/contacto">contacto</a> y <a href="https://e.cl">web</a>');
  assert.equal(enLinea('[malo](javascript:alert(1))'), 'malo)');
  assert.equal(urlSegura('//otro.sitio'), null);
  const html = respuestaHtml({
    id: 'x', titulo: 'T', formato: 'tarjeta', variante: 'cifras', respuestaCorta: 'R',
    tarjeta: { eyebrow: '<i>', cifras: [{ numero: '10', etiqueta: 'años' }], cta: { texto: 'Ir', destino: 'javascript:x' } },
  });
  assert.match(html, /<p class="pas-antetitulo">&lt;i&gt;<\/p>/);
  assert.match(html, /<p class="pas-cifra__numero">10<\/p>/);
  assert.doesNotMatch(html, /javascript/);
});
