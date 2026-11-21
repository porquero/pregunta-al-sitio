// CLI y prioridad por tipo: validar config.tipos y repeticiones, evaluar por familia, intervalos y
// avisos de la validación, comprobación sintética de calibrar, cobertura --normalizar y chips de build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { revisarTipos, avisosRepeticion, avisosAmbito } from '../../cli/validar.mjs';
import { evaluar, familiaDe } from '../../cli/evaluacion/evaluar.mjs';
import { comprobacionSintetica } from '../../cli/evaluacion/calibrar.mjs';
import { wilson, avisosValidacion } from '../../cli/evaluacion/metricas.mjs';
import { cobertura, claveUrl } from '../../cli/cobertura.mjs';
import { construirIndice } from '../../cli/build.mjs';
import { FIXTURE_PLAYA, cargarIndice, cargarPreguntas } from '../../cli/evaluacion/datos.mjs';

const BIN = fileURLToPath(new URL('../../cli/bin.mjs', import.meta.url));
const correr = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
const nodo = (id, tipo, extra = {}) => ({ id, tipo, titulo: id, preguntas: [], keywords: [], enChat: true, ...extra });

test('validar config.tipos: peso fuera de rango, claves desconocidas, tipo sin nodos y respaldo sin primera vuelta', () => {
  const nodos = [nodo('inicio', 'saludo'), nodo('contacto', 'contacto'), nodo('a', 'articulo'), nodo('s', 'servicio')];
  assert.deepEqual(revisarTipos(undefined, nodos), { errores: [], avisos: [] });
  assert.deepEqual(revisarTipos({ articulo: { peso: 0.6, respaldo: true } }, nodos), { errores: [], avisos: [] });
  const r = revisarTipos({ articulo: { peso: 2 }, servico: { peso: 1, prioridad: 3 } }, nodos);
  assert.ok(r.errores.some((e) => /articulo: peso '2' fuera de 0 a 1.5/.test(e)), r.errores.join('\n'));
  assert.ok(r.errores.some((e) => /servico: clave 'prioridad' desconocida/.test(e)));
  assert.deepEqual(r.avisos, ["sitio.yaml: config.tipos.servico: ningún nodo es de tipo 'servico'"]);
  const todos = revisarTipos({ articulo: { respaldo: true }, servicio: { respaldo: true } }, nodos);
  assert.ok(todos.errores.some((e) => /la primera vuelta no tendría dónde buscar/.test(e)));
});

test('validar avisa la repetición de un término en más del 60 % de las preguntas cuando es el tema de otro nodo', () => {
  const principal = nodo('wotel', 'producto', { titulo: 'Wotel, gestión hotelera', keywords: ['wotel'], preguntas: ['¿Qué es Wotel?', 'a', 'b', 'c', 'd'] });
  const articulo = nodo('art-wotel', 'articulo', {
    titulo: 'El problema real detrás de Wotel',
    keywords: ['historia'],
    preguntas: ['¿Por qué crearon Wotel?', 'historia de Wotel', 'Wotel y los hostales', 'lo que aprendimos con Wotel', 'otra'],
  });
  const avisos = avisosRepeticion([principal, articulo]);
  assert.deepEqual(avisos, ["art-wotel: 'wotel' está en 4 de 5 preguntas (más del 60 %) y es el tema de 'wotel'; varía las preguntas para que no compitan con ese nodo"]);
});

test('validar avisa genericas que contienen una variante del diccionario sin su forma canónica', () => {
  const sitio = { diccionario: { 'cuanto cuesta': 'precio' }, ambito: { genericas: ['cuanto cuesta un', 'que es'] } };
  assert.equal(avisosAmbito(sitio).length, 1);
  assert.match(avisosAmbito(sitio)[0], /ambito\.genericas 'cuanto cuesta un' contiene 'cuanto cuesta'/);
  assert.deepEqual(avisosAmbito({ ...sitio, ambito: { genericas: ['cuanto cuesta un', 'precio un'] } }), []);
});

test('evaluar informa por familia y cuenta la segunda vuelta; sin tipos no agrega nada', () => {
  const datos = cargarIndice();
  const consultas = cargarPreguntas();
  const base = evaluar(datos, consultas, { medicion: false });
  assert.equal(base.porFamilia, null);
  assert.equal(base.segundaVuelta, null);
  const tipos = { faq: { peso: 0.8, respaldo: true } };
  const conTipos = evaluar({ ...datos, config: { ...datos.config, tipos } }, consultas, { medicion: false });
  assert.deepEqual(Object.keys(conTipos.porFamilia), ['oferta', 'respaldo']);
  assert.equal(typeof conTipos.segundaVuelta.validacion, 'number');
  const tipoDe = new Map([['a', 'faq'], ['b', 'servicio']]);
  assert.equal(familiaDe({ esperado: ['a'] }, tipoDe, tipos), 'respaldo');
  assert.equal(familiaDe({ esperado: ['a', 'b'] }, tipoDe, tipos), 'oferta');
  assert.equal(familiaDe({ esperado: ['contacto'] }, tipoDe, tipos), null);
});

test('intervalo de Wilson y avisos de validación pequeña o sobreajuste', () => {
  const [a, b] = wilson(0.9, 74);
  assert.ok(a > 0.8 && a < 0.82 && b > 0.94 && b < 0.96, `${a} ${b}`);
  assert.deepEqual(wilson(0, 0), [0, 1]);
  const m = (top3, n, base) => ({ top3, n, base: { top3: base } });
  const avisos = avisosValidacion(m(0.979, 150, 140), m(0.869, 85, 80));
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /85 consultas \(menos de 100\): un error mueve el top-3 en 1\.3 puntos/);
  assert.match(avisos[1], /11\.0 puntos\): probable sobreajuste/);
  assert.deepEqual(avisosValidacion(m(0.95, 150, 140), m(0.9, 120, 110)), []);
});

test('comprobación sintética: título corto y primera keyword de cada nodo', () => {
  const s = comprobacionSintetica(cargarIndice());
  assert.ok(s.total > 30);
  assert.ok(Array.isArray(s.aContacto));
  for (const x of s.aContacto) assert.ok(x.nodo && x.consulta);
});

test('calibrar --escribir conserva opcionesMedia y tipos, y guarda normaPorTerminos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-tipos-'));
  cpSync(FIXTURE_PLAYA, dir, { recursive: true });
  const ruta = join(dir, 'sitio.yaml');
  const sitio = parse(readFileSync(ruta, 'utf8'));
  sitio.config = { ...sitio.config, opcionesMedia: 3, tipos: { faq: { peso: 0.8 } } };
  writeFileSync(ruta, stringify(sitio));
  const r = correr('calibrar', dir, '--escribir');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Comprobación sintética \(título corto y primera keyword de cada nodo\): \d+ de \d+ terminan en contacto/);
  assert.match(r.stdout, /Intervalos de validación \(Wilson 95 %\)/);
  const despues = parse(readFileSync(ruta, 'utf8')).config;
  assert.equal(despues.opcionesMedia, 3);
  assert.deepEqual(despues.tipos, { faq: { peso: 0.8 } });
  assert.equal(typeof despues.normaPorTerminos, 'boolean');
});

test('cobertura --normalizar ignora .html e index.html y lo dice en la salida', () => {
  assert.deepEqual(claveUrl('https://turismo.cl/tours.html', { normalizar: true }), { host: 'turismo.cl', ruta: '/tours' });
  assert.deepEqual(claveUrl('https://turismo.cl/blog/index.html', { normalizar: true }), { host: 'turismo.cl', ruta: '/blog' });
  assert.deepEqual(claveUrl('https://turismo.cl/index.html', { normalizar: true }), { host: 'turismo.cl', ruta: '/' });
  assert.deepEqual(claveUrl('https://turismo.cl/tours.html'), { host: 'turismo.cl', ruta: '/tours.html' }, 'sin la opción, tal cual');

  const raiz = mkdtempSync(join(tmpdir(), 'pas-norm-'));
  const contenido = join(raiz, 'contenido');
  mkdirSync(join(contenido, 'nodos'), { recursive: true });
  mkdirSync(join(raiz, 'fuentes'));
  writeFileSync(join(contenido, 'sitio.yaml'), 'sitio: turismo.cl\n');
  writeFileSync(join(contenido, 'nodos', 'tours.md'), '---\nid: tours\ntipo: t\ntitulo: t\nrespuesta_corta: x\nenlace: /tours\n---\n');
  writeFileSync(join(raiz, 'fuentes', 'tours.md'), '# Tours\n\nURL: https://turismo.cl/tours.html\n');
  assert.equal(cobertura(contenido, join(raiz, 'fuentes')).sinNodo.length, 1);
  assert.equal(cobertura(contenido, join(raiz, 'fuentes'), { normalizar: true }).sinNodo.length, 0);
  const sin = correr('cobertura', contenido);
  assert.equal(sin.status, 1);
  assert.match(sin.stdout, /usa --normalizar/);
  const con = correr('cobertura', contenido, '--normalizar');
  assert.equal(con.status, 0);
  assert.match(con.stdout, /URL normalizadas: sin "\.html", "index\.html" ni barra final/);
});

test('build: los chips por aristas de igual peso ponen la oferta antes que el contenido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-chips-'));
  mkdirSync(join(dir, 'nodos'));
  writeFileSync(join(dir, 'sitio.yaml'), 'nombre: X\nconfig:\n  tipos:\n    articulo: { peso: 0.6 }\n');
  const md = (id, tipo, aristas = '[]') => `---\nid: ${id}\ntipo: ${tipo}\ntitulo: ${id}\nrespuesta_corta: x\npreguntas: [a]\nkeywords: [k]\naristas: ${aristas}\nestado: aprobado\n---\n`;
  writeFileSync(join(dir, 'nodos', 'o.md'), md('o', 'servicio', '[{ a: art, peso: 0.5 }, { a: srv, peso: 0.5 }]'));
  writeFileSync(join(dir, 'nodos', 'art.md'), md('art', 'articulo'));
  writeFileSync(join(dir, 'nodos', 'srv.md'), md('srv', 'servicio'));
  const { indice } = construirIndice(dir);
  assert.deepEqual(indice.nodos.find((n) => n.id === 'o').seguimiento.map((s) => s.nodo), ['srv', 'art']);
  assert.deepEqual(indice.config.tipos, { articulo: { peso: 0.6 } }, 'build copia config.tipos al índice');
});
