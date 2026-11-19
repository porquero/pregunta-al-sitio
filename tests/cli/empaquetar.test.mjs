// El widget empaquetado (dist/) debe estar al día con src/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIDGET, cargarEsbuild, desactualizados, empaquetar } from '../../cli/empaquetar.mjs';
import { FIXTURE_PLAYA } from '../../cli/evaluacion/datos.mjs';

const hash = (texto) => createHash('sha256').update(texto).digest('hex');
const BIN = fileURLToPath(new URL('../../cli/bin.mjs', import.meta.url));

test('dist/pregunta-al-sitio.js es igual a una compilación nueva de src/', { skip: (!existsSync(WIDGET) || !cargarEsbuild()) && 'falta dist o esbuild' }, () => {
  const nuevo = empaquetar({ escribir: false });
  assert.equal(hash(readFileSync(WIDGET, 'utf8')), hash(nuevo), 'dist/ está desactualizado: corre npm run empaquetar');
});

test('desactualizados detecta archivos de src más recientes que el bundle', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-emp-'));
  mkdirSync(join(dir, 'src', 'widget'), { recursive: true });
  const bundle = join(dir, 'dist.js');
  assert.deepEqual(desactualizados(join(dir, 'src'), bundle), ['(falta el archivo empaquetado)']);
  writeFileSync(join(dir, 'src', 'widget', 'a.js'), '1');
  writeFileSync(bundle, 'x');
  const antes = new Date(Date.now() - 60_000);
  utimesSync(join(dir, 'src', 'widget', 'a.js'), antes, antes);
  assert.deepEqual(desactualizados(join(dir, 'src'), bundle), []);
  const despues = new Date(Date.now() + 60_000);
  utimesSync(join(dir, 'src', 'widget', 'a.js'), despues, despues);
  assert.deepEqual(desactualizados(join(dir, 'src'), bundle), ['src/widget/a.js']);
});

test('build --widget sin esbuild copia el script solo si está al día', { skip: !existsSync(WIDGET) && 'falta npm run empaquetar' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'pas-emp-'));
  cpSync(FIXTURE_PLAYA, dir, { recursive: true });
  const salida = join(dir, 'publico', 'indice.json');
  const r = spawnSync(process.execPath, [BIN, 'build', dir, '-o', salida, '--widget'], { encoding: 'utf8', env: { ...process.env, PAS_NO_EMPAQUETAR: '1' } });
  if (desactualizados().length) {
    assert.equal(r.status, 1);
    assert.match(r.stderr, /está desactualizado: .* Corre `npm run empaquetar`/);
    assert.ok(!existsSync(salida), 'no escribe el índice si el widget está viejo');
  } else {
    assert.equal(r.status, 0, r.stderr);
    assert.equal(hash(readFileSync(join(dir, 'publico', 'pregunta-al-sitio.js'))), hash(readFileSync(WIDGET)));
  }
});
