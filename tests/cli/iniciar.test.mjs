// iniciar, skill y revisión del set de evaluación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { iniciarSitio, instalarSkill } from '../../cli/iniciar.mjs';
import { validarSitio } from '../../cli/validar.mjs';
import { construirIndice } from '../../cli/build.mjs';
import { revisarPreguntas } from '../../cli/evaluacion/preguntas.mjs';
import { cargarIndice, cargarPreguntas } from '../../cli/evaluacion/datos.mjs';
import { crearResolver } from '../../src/motor/resolver.js';

const temporal = () => mkdtempSync(join(tmpdir(), 'pas-ini-'));

test('iniciar crea un sitio en borrador que pasa validar y build', () => {
  const dir = join(temporal(), 'acme');
  const creados = iniciarSitio(dir, { nombre: 'Ferretería Acme' });
  assert.deepEqual(creados.sort(), ['informes/.gitkeep', 'nodos/contacto.md', 'nodos/inicio.md', 'preguntas.yaml', 'sitio.yaml']);
  const sitio = parse(readFileSync(join(dir, 'sitio.yaml'), 'utf8'));
  assert.equal(sitio.nombre, 'Ferretería Acme');
  assert.ok(sitio.ambito.marcas.includes('ferretería acme'));
  assert.ok(sitio.ambito.genericas.includes('que es'));

  const { errores, avisos } = validarSitio(dir);
  assert.deepEqual(errores, []);
  assert.deepEqual(avisos.sort(), [
    'contacto: 1 [REDACTAR] pendiente(s)',
    'inicio: 1 [REDACTAR] pendiente(s)',
    'inicio: una sola arista saliente (con dos o más los chips varían)',
    'sitio.yaml: completa sitio con el dominio principal (misitio.cl)',
  ]);

  assert.equal(construirIndice(dir).indice.nodos.length, 0, 'sin aprobados, el índice va vacío');
  const indice = construirIndice(dir, { borradores: true }).indice;
  assert.equal(indice.derivacion.startsWith('Este asistente responde sobre Ferretería Acme'), true);
  const r = crearResolver(indice);
  assert.equal(r.resolver('¿Qué es la inflación?').zona, 'baja');
  assert.equal(r.resolver('¿Cómo los contacto?').nodos[0], 'contacto');

  const { errores: erroresSet } = revisarPreguntas(cargarPreguntas(join(dir, 'preguntas.yaml')), indice);
  assert.deepEqual(erroresSet, []);
});

test('iniciar no sobrescribe un sitio existente', () => {
  const dir = temporal();
  iniciarSitio(dir);
  assert.throws(() => iniciarSitio(dir), /ya existe/);
});

test('skill copia la guía con sus referencias', () => {
  const destino = instalarSkill(temporal());
  assert.match(readFileSync(join(destino, 'SKILL.md'), 'utf8'), /^---\nname: pregunta-al-sitio-contenido\ndescription: /);
  assert.deepEqual(readdirSync(join(destino, 'referencia')).sort(), ['ambito-y-diccionario.md', 'diagnostico.md', 'nodos.md', 'preguntas.md', 'rubros.md']);
});

test('los enlaces de la guía apuntan a archivos que existen', () => {
  const guia = new URL('../../guia-contenido/', import.meta.url);
  const texto = readFileSync(new URL('SKILL.md', guia), 'utf8');
  const enlaces = [...texto.matchAll(/\]\((referencia\/[^)]+)\)/g)].map((m) => m[1]);
  assert.ok(enlaces.length >= 4);
  for (const e of enlaces) assert.ok(existsSync(new URL(e, guia)), e);
});

test('el set de Playa no tiene errores; le falta cubrir un nodo', () => {
  assert.deepEqual(revisarPreguntas(cargarPreguntas(), cargarIndice()), {
    errores: [],
    avisos: ["set: ninguna consulta espera el nodo 'por-que-playa'"],
  });
});

test('la revisión del set encuentra ids, tipos y repetidas', () => {
  const indice = { nodos: [{ id: 'a' }, { id: 'b' }] };
  const c = (consulta, esperado, tipo = 'anexo', extra = {}) => ({ consulta, esperado: [].concat(esperado), tipo, ...extra });
  const consultas = [
    c('uno', 'a'),
    c('Uno', 'a'),
    c('dos', 'zeta'),
    c('tres', 'a', 'raro'),
    c('cuatro', 'a', 'general'),
    c('cinco', 'contacto', 'seguimiento', { contexto: 'nada' }),
  ].map((x, n) => ({ ...x, n }));
  const { errores, avisos } = revisarPreguntas(consultas, indice);
  assert.deepEqual(errores, [
    '"Uno": repetida',
    "\"dos\": esperado 'zeta' no es un nodo del chat",
    "\"tres\": tipo 'raro' inválido (anexo, coloquial, tipeo, multiple, general, necesidad, ajena, fuera, seguimiento)",
    '"cuatro": las de tipo general esperan solo contacto',
    "\"cinco\": contexto 'nada' no es un nodo del chat",
  ]);
  assert.ok(avisos.includes("set: ninguna consulta espera el nodo 'b'"));
  assert.ok(avisos.includes('set: 6 consultas total (mínimo 150)'));
});
