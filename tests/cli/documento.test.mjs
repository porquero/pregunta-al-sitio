// Documento local: con sitio: localhost, build escribe index.html con los nodos como secciones y el chat
// dentro; los enlaces del chat llevan a la sección del nodo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construirIndice } from '../../cli/build.mjs';
import { esLocal, bloquesHtml, crearAnclas } from '../../cli/documento.mjs';
import { crearFiltroUrl, dominiosDe } from '../../cli/contenido/html.mjs';

const BIN = fileURLToPath(new URL('../../cli/bin.mjs', import.meta.url));
const correr = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

const nodo = (id, tipo, extra = '', cuerpo = '') =>
  `---\nid: ${id}\ntipo: ${tipo}\ntitulo: Título de ${id}\n${extra.includes('respuesta_corta') ? '' : `respuesta_corta: Respuesta de ${id}.\n`}preguntas: [¿Qué es ${id}?]\nkeywords: [${id}]\nestado: aprobado\n${extra}---\n${cuerpo}\n`;

function documento(sitio = 'localhost') {
  const dir = mkdtempSync(join(tmpdir(), 'pas-doc-'));
  mkdirSync(join(dir, 'nodos'));
  writeFileSync(join(dir, 'sitio.yaml'), `nombre: Manual de prueba\nsitio: ${sitio}\n`);
  writeFileSync(join(dir, 'nodos', 'a-inicio.md'), nodo('inicio', 'saludo'));
  writeFileSync(
    join(dir, 'nodos', 'b-alcance.md'),
    nodo('alcance', 'seccion', 'enlace: /alcance.html\nrespuesta_corta: Ver [plazos](http://localhost/plazos) y [un sitio](https://otro.cl/x).\n', '## Detalle\n\nTexto con [plazos](nodo:plazos).\n\n- uno\n- dos'),
  );
  writeFileSync(join(dir, 'nodos', 'c-plazos.md'), nodo('plazos', 'seccion', 'enlace: /plazos\n', '| Etapa | Días |\n|---|---|\n| Revisión | 10 |'));
  writeFileSync(join(dir, 'nodos', 'd-sin-cuerpo.md'), nodo('contacto', 'contacto'));
  return dir;
}

test('localhost es un dominio del sitio y activa el documento local', () => {
  assert.deepEqual(dominiosDe('localhost'), ['localhost']);
  assert.deepEqual(dominiosDe('http://localhost:8080/'), ['localhost']);
  assert.ok(esLocal('localhost') && esLocal(['127.0.0.1']) && !esLocal('misitio.cl') && !esLocal(undefined));
});

test('anclas: la ruta del enlace de un nodo, con o sin .html ni host, lleva a su sección', () => {
  const anclas = crearAnclas([{ id: 'plazos', enlace: '/plazos.html' }], crearFiltroUrl(['localhost']));
  for (const u of ['/plazos', '/plazos/', 'http://localhost:3000/plazos.html', '/plazos#etapas']) assert.equal(anclas(u), '#plazos', u);
  assert.equal(anclas('/otra'), '/otra');
  assert.equal(anclas('mailto:a@b.cl'), 'mailto:a@b.cl');
  assert.equal(anclas(null), null);
});

test('build con sitio localhost: "Ver más" y enlaces de las respuestas apuntan a las secciones', () => {
  const { indice, documento: doc, omitidos } = construirIndice(documento());
  const porId = new Map(indice.nodos.map((n) => [n.id, n]));
  assert.equal(porId.get('alcance').enlace, '#alcance');
  assert.equal(porId.get('plazos').enlace, '#plazos');
  assert.equal(porId.get('contacto').enlace, null, 'sin enlace ni cuerpo: sin "Ver más"');
  assert.match(porId.get('alcance').respuesta, /<a href="#plazos">plazos<\/a>/);
  assert.doesNotMatch(porId.get('alcance').respuesta, /otro\.cl/, 'lo externo se sigue omitiendo');
  assert.equal(omitidos, 1);
  assert.deepEqual(doc.secciones.map((n) => n.id), ['alcance', 'plazos', 'contacto'], 'el saludo no es sección');
});

test('build sin localhost no cambia: sin documento y enlaces tal cual', () => {
  const { indice, documento: doc } = construirIndice(documento('misitio.cl'));
  assert.equal(doc, null);
  assert.equal(indice.nodos.find((n) => n.id === 'alcance').enlace, '/alcance.html');
});

test('Markdown de bloque: títulos bajan dos niveles, listas, tablas, código e imágenes; todo escapado', () => {
  const html = bloquesHtml('# Uno\n\nTexto <b>x</b> y **negrita**.\n\n1. a\n2. b\n\n```\n<código>\n```\n\n> cita\n\n![logo](/logo.png) ![mal](javascript:alert)\n\n---');
  assert.match(html, /<h3>Uno<\/h3>/);
  assert.match(html, /<p>Texto &lt;b&gt;x&lt;\/b&gt; y <strong>negrita<\/strong>\.<\/p>/);
  assert.match(html, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.match(html, /<pre><code>&lt;código&gt;<\/code><\/pre>/);
  assert.match(html, /<blockquote><p>cita<\/p><\/blockquote>/);
  assert.match(html, /<img src="\/logo\.png" alt="logo" loading="lazy"> mal/);
  assert.match(html, /<hr>/);
});

test('comando build: escribe index.html con secciones, índice incrustado y widget; no pisa un index.html ajeno', () => {
  const dir = documento();
  const r = correr('build', dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /documento local \(sitio: localhost\): 3 secciones/);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.match(html, /<section id="alcance">/);
  assert.match(html, /<a href="#plazos">plazos<\/a>/, 'nodo:plazos en el cuerpo es un ancla de la página');
  assert.match(html, /<table>/);
  assert.match(html, /<script type="application\/json" id="pas-indice">/);
  assert.match(html, /PreguntaAlSitioConfig/);
  assert.doesNotMatch(html.split('id="pas-indice">')[1].split('</script>')[0], /</, 'el JSON no trae "<" literal');
  const json = html.split('id="pas-indice">')[1].split('</script>')[0];
  assert.equal(JSON.parse(json).nodos.length, 4);

  assert.equal(correr('build', dir).status, 0, 'reemplaza su propio index.html');
  writeFileSync(join(dir, 'index.html'), '<!doctype html><p>mío</p>');
  const ajeno = correr('build', dir);
  assert.equal(ajeno.status, 1);
  assert.match(ajeno.stderr, /no lo generó pregunta-al-sitio/);
  assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), '<!doctype html><p>mío</p>');
});
