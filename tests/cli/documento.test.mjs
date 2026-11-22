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
import { esLocal, bloquesHtml, crearAnclas, gruposDe, descripcionDe, preguntasDe, PLEGAR_DESDE } from '../../cli/documento.mjs';
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

test('anclas con fragmento: varios nodos en la misma página (/rca#id) no se confunden', () => {
  const nodos = [
    { id: 'aguas', enlace: '/rca#aguas-servidas' },
    { id: 'cierre-faena', enlace: '/rca#cierre' },
    { id: 'c95', enlace: 'http://localhost/rca.html#c95' },
  ];
  const anclas = crearAnclas(nodos, crearFiltroUrl(['localhost']));
  assert.equal(anclas('/rca#cierre'), '#cierre-faena');
  assert.equal(anclas('#cierre'), '#cierre-faena');
  assert.equal(anclas('/rca.html#aguas-servidas'), '#aguas');
  assert.equal(anclas('#c95'), '#c95');
  assert.equal(anclas('#aguas'), '#aguas', 'un fragmento que ya es id de sección');
  assert.equal(anclas('/rca'), '/rca', 'ruta compartida por varios nodos: sin destino único');
  assert.equal(anclas('#otro'), '#otro');
});

test('grupos: los de documento.grupos en su orden y con su nombre; el resto por orden de aparición', () => {
  const nodos = [{ id: 'a', tipo: 'medida' }, { id: 'b', tipo: 'impacto' }, { id: 'c', tipo: 'proyecto' }, { id: 'd', tipo: 'impacto' }];
  const g = gruposDe(nodos, { proyecto: 'El proyecto', impacto: 'Impactos evaluados', vacio: 'Sin nodos' });
  assert.deepEqual(g.map((x) => [x.titulo, x.nodos.map((n) => n.id)]), [
    ['El proyecto', ['c']],
    ['Impactos evaluados', ['b', 'd']],
    ['Medida', ['a']],
  ]);
});

test('Markdown de bloque: títulos bajan tres niveles, listas, tablas, código e imágenes; todo escapado', () => {
  const html = bloquesHtml('# Uno\n\nTexto <b>x</b> y **negrita**.\n\n1. a\n2. b\n\n```\n<código>\n```\n\n> cita\n\n![logo](/logo.png) ![mal](javascript:alert)\n\n---');
  assert.match(html, /<h4>Uno<\/h4>/);
  assert.match(bloquesHtml('# Uno', { nivel: 1 }), /<h2>Uno<\/h2>/);
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
  assert.match(html, /<section class="seccion" id="alcance" aria-labelledby="t-alcance">/);
  assert.match(html, /<p class="ceja">Seccion · 01<\/p>/);
  assert.match(html, /<input id="buscar" type="search"/);
  assert.match(html, /<li data-buscar="alcance"><a href="#alcance">Título de alcance<\/a><\/li>/);
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

test('sitio.yaml > documento: cabecera, grupos, pie; cuerpo largo plegado y fuente del nodo', () => {
  const dir = documento();
  writeFileSync(
    join(dir, 'sitio.yaml'),
    'nombre: Visor\nsitio: localhost\ndocumento:\n  antetitulo: Resolución\n  titulo: Proyecto X\n  descripcion: Texto organizado.\n  grupos: { contacto: Ayuda, seccion: Contenido }\n  detalle: Texto de la resolución\n  pie: Basado en la resolución original.\n',
  );
  const largo = Array(PLEGAR_DESDE + 5).fill('palabra').join(' ');
  writeFileSync(join(dir, 'nodos', 'c-plazos.md'), nodo('plazos', 'seccion', 'fuente: "RCA, Considerando 4"\n', largo));
  assert.equal(correr('build', dir).status, 0);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.match(html, /<title>Visor · Proyecto X<\/title>/);
  assert.match(html, /<p class="antetitulo">Resolución<\/p>\n<h1>Proyecto X<\/h1>\n<p class="descripcion">Texto organizado\.<\/p>/);
  assert.ok(html.indexOf('<h2 id="grupo-contacto">Ayuda</h2>') < html.indexOf('<h2 id="grupo-seccion">Contenido</h2>'));
  assert.match(html, /<details><summary>Texto de la resolución<\/summary><div class="cuerpo"><p>palabra/);
  assert.match(html, /<p class="fuente">Fuente: RCA, Considerando 4<\/p>/);
  assert.match(html, /<footer>Basado en la resolución original\.<\/footer>/);
  assert.doesNotMatch(html.split('id="alcance"')[1].split('</section>')[0], /<details>/, 'cuerpo corto: a la vista');
});

test('texto_original: plegado bajo "Texto original", el cuerpo queda a la vista y no entra al índice', () => {
  const dir = documento();
  const largo = Array(PLEGAR_DESDE + 5).fill('palabra').join(' ');
  writeFileSync(
    join(dir, 'nodos', 'c-plazos.md'),
    nodo('plazos', 'seccion', 'fuente: "RCA, Considerando 4"\ntexto_original: |\n  4.1 Que el plazo <de> revisión es de **10 días**.\n\n  4.2 Segundo párrafo.\n', largo),
  );
  const r = correr('build', dir);
  assert.equal(r.status, 0, r.stderr);
  const seccion = readFileSync(join(dir, 'index.html'), 'utf8').split('id="plazos"')[1].split('</section>')[0];
  assert.match(seccion, /<p class="resumen">.*<\/p>\n<div class="cuerpo"><p>palabra/, 'cuerpo largo a la vista');
  assert.match(
    seccion,
    /<details><summary>Texto original<\/summary><div class="cuerpo"><p>4\.1 Que el plazo &lt;de&gt; revisión es de <strong>10 días<\/strong>\.<\/p>\n<p>4\.2 Segundo párrafo\.<\/p><\/div><\/details>\n<p class="fuente">/,
  );
  assert.equal((seccion.match(/<details>/g) ?? []).length, 1);
  assert.doesNotMatch(readFileSync(join(dir, 'indice.json'), 'utf8'), /Segundo párrafo/);
});

test('cabecera: bajada con respaldo, cifras, botón al chat y preguntas de ejemplo; presentación opcional', () => {
  assert.equal(descripcionDe({ documento: { descripcion: 'A' }, descripcion: 'B', rubro: { descripcion: 'C' } }), 'A');
  assert.equal(descripcionDe({ descripcion: ' B ', rubro: { descripcion: 'C' } }), 'B');
  assert.equal(descripcionDe({ rubro: { descripcion: 'C' } }), 'C');
  assert.equal(descripcionDe({}), null);
  const grupos = [
    { nodos: [{ tipo: 'contacto', preguntas: ['¿Contacto?'] }] },
    { nodos: [{ tipo: 'seccion', preguntas: [] }, { tipo: 'seccion', preguntas: ['¿Plazos?', '¿Otra?'] }] },
  ];
  assert.deepEqual(preguntasDe(grupos), ['¿Plazos?']);
  assert.deepEqual(preguntasDe(grupos, ['¿Una?', ' ']), ['¿Una?']);
  assert.deepEqual(preguntasDe(grupos, []), []);

  const dir = documento();
  writeFileSync(
    join(dir, 'sitio.yaml'),
    'nombre: Manual\nsitio: localhost\nrubro:\n  descripcion: Manual de la comunidad.\ndocumento:\n  presentacion: |\n    Este manual reúne las **normas** del edificio.\n',
  );
  assert.equal(correr('build', dir).status, 0);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.match(html, /<p class="descripcion">Manual de la comunidad\.<\/p>/);
  assert.match(html, /<meta name="description" content="Manual de la comunidad\.">/);
  assert.match(html, /<button class="preguntar" type="button" data-pregunta-al-sitio="">Hacer una pregunta<\/button><span class="cifras">3 secciones en 2 grupos<\/span>/);
  assert.match(html, /<button type="button" data-pregunta-al-sitio="¿Qué es alcance\?">¿Qué es alcance\?<\/button>/);
  assert.match(html, /<main id="contenido">\n<section class="seccion presentacion" id="presentacion"[^>]*><h3 id="t-presentacion">Presentación<\/h3><div class="cuerpo"><p>Este manual reúne las <strong>normas<\/strong> del edificio\.<\/p>/);
  assert.match(html, /<li><a href="#presentacion">Presentación<\/a><\/li>/);
});
