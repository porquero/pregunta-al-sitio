// Recolector PHP de consultas (servidor/recolector): se prueba con el servidor integrado de PHP. Sin PHP en
// el PATH, los tests se omiten.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../servidor/recolector/', import.meta.url));
const hayPhp = !spawnSync('php', ['-v'], { encoding: 'utf8' }).error;
const omitir = hayPhp ? false : 'PHP no está instalado';

const puerto = 20000 + Math.floor(Math.random() * 20000);
const origen = `http://127.0.0.1:${puerto}`;
const url = `${origen}/registrar-consultas.php`;
const csv = join(mkdtempSync(join(tmpdir(), 'pas-recolector-')), 'datos', 'consultas.csv');
let servidor;

before(async () => {
  if (!hayPhp) return;
  servidor = spawn('php', ['-S', `127.0.0.1:${puerto}`, '-t', DIR], {
    env: { ...process.env, PAS_ORIGENES: origen, PAS_ARCHIVO: csv, PAS_LIMITE: '100' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetch(url, { method: 'GET' });
      return;
    } catch {
      await new Promise((ok) => setTimeout(ok, 100));
    }
  }
  throw new Error('el servidor PHP no arrancó');
});

after(() => servidor?.kill());

const enviar = (cuerpo, { desde = origen, metodo = 'POST' } = {}) =>
  fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json', Origin: desde }, body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined });

const filas = () => (existsSync(csv) ? readFileSync(csv, 'utf8').replace(/^\uFEFF/, '').trim().split('\n') : []);

test('guarda FECHA;URL;TEXTO;RESPUESTA, oculta datos personales y quita query de la url', { skip: omitir }, async () => {
  const r = await enviar({ texto: '¿Tienen tours? Mi fono +56 9 1234 5678 y correo a@b.cl', url: `${origen}/tours?utm=x#y`, respuesta: 'Tours en la costa' });
  assert.equal(r.status, 204);
  const [cabecera, fila] = filas();
  assert.equal(cabecera, 'FECHA;URL;TEXTO;RESPUESTA');
  assert.match(fila, /^"\d{4}-\d\d-\d\d \d\d:\d\d:\d\d";http:\/\/127\.0\.0\.1:\d+\/tours;"¿Tienen tours\? Mi fono \[número\] y correo \[correo\]";"Tours en la costa"$/);
});

test('sin respuesta (widget anterior) deja la columna vacía; una fórmula se neutraliza', { skip: omitir }, async () => {
  assert.equal((await enviar({ texto: 'hola', url: `${origen}/` })).status, 204);
  assert.equal((await enviar({ texto: '=1+1', url: `${origen}/`, respuesta: '@x' })).status, 204);
  const [, , sinRespuesta, formula] = filas();
  assert.match(sinRespuesta, /;hola;$/);
  assert.match(formula, /;'=1\+1;'@x$/);
});

test('rechaza otros orígenes y métodos; un texto que es solo datos personales no se guarda', { skip: omitir }, async () => {
  const antes = filas().length;
  assert.equal((await enviar({ texto: 'hola', url: `${origen}/` }, { desde: 'https://otro.cl' })).status, 403);
  assert.equal((await enviar(null, { metodo: 'GET' })).status, 405);
  assert.equal((await enviar({ texto: 'hola', url: 'https://otro.cl/' })).status, 400);
  assert.equal((await enviar({ texto: 'a@b.cl', url: `${origen}/` })).status, 204);
  assert.equal(filas().length, antes);
  const pre = await fetch(url, { method: 'OPTIONS', headers: { Origin: origen } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), origen);
});
