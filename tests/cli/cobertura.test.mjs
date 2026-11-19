// cobertura: una fuente con URL: es un nodo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cobertura, claveUrl } from '../../cli/cobertura.mjs';

const BIN = fileURLToPath(new URL('../../cli/bin.mjs', import.meta.url));

function proyecto(sitio = 'sitio: turismo.cl\n') {
  const raiz = mkdtempSync(join(tmpdir(), 'pas-cob-'));
  const contenido = join(raiz, 'contenido');
  mkdirSync(join(contenido, 'nodos'), { recursive: true });
  mkdirSync(join(raiz, 'fuentes', 'blog'), { recursive: true });
  writeFileSync(join(contenido, 'sitio.yaml'), sitio);
  const nodo = (id, enlace) => `---\nid: ${id}\ntipo: t\ntitulo: ${id}\nrespuesta_corta: x\nenlace: ${enlace}\n---\n`;
  writeFileSync(join(contenido, 'nodos', 'tours.md'), nodo('tours', '/tours/'));
  writeFileSync(join(contenido, 'nodos', 'casona.md'), nodo('casona', 'https://www.turismo.cl/casona'));
  const fuente = (archivo, url) => writeFileSync(join(raiz, 'fuentes', archivo), `# Página\n\nURL: ${url}\n\nTexto.\n`);
  fuente('tours.md', 'https://turismo.cl/tours');
  fuente('casona.md', 'https://turismo.cl/casona/?ref=menu');
  fuente('blog/noticia.md', 'https://www.turismo.cl/blog/noticia');
  fuente('duplicado.md', 'https://turismo.cl/tours-copia');
  writeFileSync(join(raiz, 'fuentes', 'sin-url.md'), '# Notas internas\n');
  return { raiz, contenido, fuentes: join(raiz, 'fuentes') };
}

test('claveUrl compara sin esquema, www, barra final, consulta ni ancla', () => {
  assert.deepEqual(claveUrl('https://www.Turismo.cl/Tours/?a=1#x'), { host: 'turismo.cl', ruta: '/Tours' });
  assert.deepEqual(claveUrl('/tours/'), { host: null, ruta: '/tours' });
  assert.deepEqual(claveUrl('turismo.cl'), { host: 'turismo.cl', ruta: '/' });
});

test('lista las fuentes con URL sin nodo; las rutas relativas valen para el sitio', () => {
  const p = proyecto();
  const { fuentes, sinNodo } = cobertura(p.contenido, p.fuentes);
  assert.equal(fuentes.length, 4, 'sin-url.md no cuenta');
  assert.deepEqual(fuentes.find((f) => f.archivo === 'tours.md').nodos, ['tours']);
  assert.deepEqual(fuentes.find((f) => f.archivo === 'casona.md').nodos, ['casona']);
  assert.deepEqual(sinNodo.map((f) => f.archivo).sort(), ['blog/noticia.md', 'duplicado.md']);
});

test('cobertura.excluir en sitio.yaml y código de salida', () => {
  const p = proyecto('sitio: turismo.cl\ncobertura:\n  excluir: [https://turismo.cl/tours-copia]\n');
  assert.deepEqual(cobertura(p.contenido, p.fuentes).sinNodo.map((f) => f.archivo), ['blog/noticia.md']);
  const r = spawnSync(process.execPath, [BIN, 'cobertura', p.contenido], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sin nodo {2}https:\/\/www\.turismo\.cl\/blog\/noticia {2}\(blog\/noticia\.md\)/);
  assert.match(r.stdout, /4 fuentes con URL · 2 con nodo · 1 excluidas · 1 sin nodo/);
  writeFileSync(join(p.contenido, 'nodos', 'noticia.md'), '---\nid: noticia\ntipo: t\ntitulo: n\nrespuesta_corta: x\nenlace: /blog/noticia\n---\n');
  assert.equal(spawnSync(process.execPath, [BIN, 'cobertura', p.contenido, '--fuentes', p.fuentes], { encoding: 'utf8' }).status, 0);
});
