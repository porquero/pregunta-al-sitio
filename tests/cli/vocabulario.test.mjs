// vocabulario: palabras frecuentes de las fuentes que el chat no responde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contarPalabras, leerFuentes, vocabulario } from '../../cli/vocabulario.mjs';

const BIN = fileURLToPath(new URL('../../cli/bin.mjs', import.meta.url));

function proyecto(sitio = 'nombre: Prueba\n') {
  const raiz = mkdtempSync(join(tmpdir(), 'pas-voc-'));
  const contenido = join(raiz, 'contenido');
  mkdirSync(join(contenido, 'nodos'), { recursive: true });
  mkdirSync(join(raiz, 'fuentes'), { recursive: true });
  writeFileSync(join(contenido, 'sitio.yaml'), sitio);
  writeFileSync(
    join(contenido, 'nodos', 'ruido.md'),
    `---\nid: ruido\ntipo: tema\ntitulo: Ruido y vibraciones\nrespuesta_corta: El ruido proviene de la maquinaria y de las tronaduras del proyecto.\npreguntas:\n  - ¿Habrá ruido?\n  - ¿Hay vibraciones?\nkeywords: [ruido, vibraciones]\nestado: aprobado\n---\n`,
  );
  const imagen = '![Image](data:image/png;base64,' + 'iVBORw0KGgo'.repeat(200) + ')';
  writeFileSync(
    join(contenido, '..', 'fuentes', 'doc.md'),
    `${imagen}\nURL: https://sitio.cl/evento\n` +
      'Ruido ruido. '.repeat(3) +
      'Evento. '.repeat(6) +
      'Aviso. '.repeat(2),
  );
  return { raiz, contenido, fuentes: join(raiz, 'fuentes') };
}

test('contarPalabras ignora stopwords, palabras cortas y signos', () => {
  const c = contarPalabras('El evento del evento; la AUTORIDAD y el ruido. Otra vez el evento, 123 y sí.');
  assert.equal(c.get('evento'), 3);
  assert.equal(c.get('autoridad'), 1);
  assert.ok(!c.has('123') && !c.has('del') && !c.has('si'));
});

test('leerFuentes quita imágenes base64 y enlaces', () => {
  const p = proyecto();
  const t = leerFuentes(p.fuentes);
  assert.ok(!/base64|iVBOR|https?:/.test(t));
  assert.match(t, /Ruido ruido/);
});

test('lista las palabras frecuentes sin resultado y respeta ignorar y min', () => {
  const p = proyecto();
  const datos = JSON.parse(
    JSON.stringify({
      nodos: [{ id: 'ruido', tipo: 'tema', titulo: 'Ruido y vibraciones', preguntas: ['¿Habrá ruido?'], keywords: ['ruido'], sinonimos: [], aristas: [] }],
    }),
  );
  const texto = leerFuentes(p.fuentes);
  const r = vocabulario(datos, texto, { min: 5 });
  assert.deepEqual(r.sinResultado.map((x) => x.palabra), ['evento'], '"ruido" responde; "aviso" aparece menos de 5 veces');
  assert.equal(r.sinResultado[0].veces, 6);
  assert.deepEqual(vocabulario(datos, texto, { min: 5, ignorar: ['evento'] }).sinResultado, []);
  assert.ok(vocabulario(datos, texto, { min: 2 }).sinResultado.some((x) => x.palabra === 'aviso'));
});

test('comando vocabulario: sale con 1 si hay palabras sin resultado y con 0 al cubrirlas', () => {
  const p = proyecto();
  const correr = () => spawnSync(process.execPath, [BIN, 'vocabulario', p.contenido, '--fuentes', p.fuentes], { encoding: 'utf8' });
  let r = correr();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /sin resultado {2}evento {2}\(6 veces\)/);
  writeFileSync(join(p.contenido, 'sitio.yaml'), 'nombre: Prueba\nvocabulario:\n  ignorar: [evento]\n');
  r = correr();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 sin resultado/);
});
