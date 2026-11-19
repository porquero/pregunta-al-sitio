// Comandos del CLI sobre una copia del fixture de Playa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { FIXTURE_PLAYA } from '../../cli/evaluacion/datos.mjs';

const BIN = fileURLToPath(new URL('../../cli/bin.mjs', import.meta.url));
const correr = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

function copia() {
  const dir = mkdtempSync(join(tmpdir(), 'pas-cli-'));
  cpSync(FIXTURE_PLAYA, dir, { recursive: true });
  return dir;
}

test('sin comando muestra la ayuda y sale con 2', () => {
  const r = correr();
  assert.equal(r.status, 2);
  assert.match(r.stdout, /Uso: pregunta-al-sitio/);
  assert.equal(correr('otro').status, 2);
});

test('build escribe el índice', () => {
  const dir = copia();
  const salida = join(dir, 'publico', 'indice.json');
  const r = correr('build', dir, '-o', salida);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /34 nodos en el chat/);
  assert.equal(JSON.parse(readFileSync(salida, 'utf8')).nodos.length, 34);
});

test('validar sale con 1 si hay errores', () => {
  const dir = copia();
  assert.equal(correr('validar', dir).status, 0);
  const ruta = join(dir, 'nodos', 'wotel.md');
  writeFileSync(ruta, readFileSync(ruta, 'utf8').replace('estado: aprobado', 'estado: listo'));
  const r = correr('validar', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /wotel: estado 'listo' inválido/);
});

test('evaluar informa las métricas de validación', () => {
  const r = correr('evaluar', FIXTURE_PLAYA);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Validación: top-1 91\.3% · top-3 97\.8% .* prec\. alta 100\.0% .* fuga 0\.0% · falso rechazo 2\.4% · cumple/);
  assert.match(r.stdout, /Seguimiento \(8, fuera de las métricas: el chat responde sin contexto\): acierto 75\.0%/);
});

test('calibrar --escribir guarda la config en sitio.yaml y conserva los comentarios', () => {
  const dir = copia();
  const r = correr('calibrar', dir, '--escribir');
  assert.equal(r.status, 0, r.stderr);
  const texto = readFileSync(join(dir, 'sitio.yaml'), 'utf8');
  assert.match(texto, /^# Sitio de referencia: Playa SPA/);
  const sitio = parse(texto);
  assert.equal(sitio.config.zonas.Ta, 1);
  assert.equal(sitio.config.motor.k1, 1.2);
  assert.equal(sitio.config.opcionesMedia, 2);
  assert.equal(sitio.nombre, 'Playa SPA');
});
