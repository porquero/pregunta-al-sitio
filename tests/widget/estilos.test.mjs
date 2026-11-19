// Cascada de ESTILOS para los <a> con aspecto de botón. Sin navegador: se calcula qué regla gana por
// especificidad y orden entre las que pueden alcanzar a cada elemento. El color calculado real se revisa
// en dev/ (?modo=enlace).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTILOS } from '../../src/widget/estilos.js';

/** Reglas planas { selector, decl, orden } del CSS (sin @media: los temas solo cambian variables). */
function reglas(css) {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const salida = [];
  let orden = 0;
  for (const m of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = Object.fromEntries(
      m[2].split(';').map((d) => d.split(':')).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join(':').trim()]),
    );
    for (const selector of m[1].split(',')) salida.push({ selector: selector.trim(), decl, orden: orden++ });
  }
  return salida;
}

/** Especificidad [ids, clases/atributos/pseudoclases, elementos]; :not() cuenta su argumento. */
function especificidad(selector) {
  const s = selector.replace(/:not\(([^)]*)\)/g, ' $1');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const clases = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
  const elementos = (s.replace(/\[[^\]]*\]|[.#:][\w-]+/g, ' ').match(/\b[a-z][\w-]*\b/g) ?? []).length;
  return [ids, clases, elementos];
}

const mayor = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Coincidencia aproximada: el último compuesto del selector debe calzar con el elemento (etiqueta y
 * clases), sin un :not() que lo excluya, y los ancestros nombrados deben estar en la cadena.
 */
function calza(selector, { etiqueta, clases, ancestros }) {
  const partes = selector.split(/\s+|>/).filter(Boolean);
  const ultimo = partes.at(-1);
  if (/:(hover|focus|active|disabled|focus-visible|empty)\b|\[/.test(ultimo)) return false;
  const excluidas = [...ultimo.matchAll(/:not\(\.([\w-]+)\)/g)].map((m) => m[1]);
  if (excluidas.some((c) => clases.includes(c))) return false;
  const base = ultimo.replace(/:not\([^)]*\)/g, '');
  const tag = base.match(/^[a-z][\w-]*/)?.[0];
  if (tag && tag !== etiqueta) return false;
  const requeridas = [...base.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  if (!requeridas.length && !tag) return false;
  if (!requeridas.every((c) => clases.includes(c))) return false;
  return partes.slice(0, -1).every((p) => ancestros.includes(p));
}

function valorGanador(elemento, propiedad) {
  const candidatas = reglas(ESTILOS).filter((r) => propiedad in r.decl && calza(r.selector, elemento));
  candidatas.sort((a, b) => mayor(especificidad(a.selector), especificidad(b.selector)) || a.orden - b.orden);
  return candidatas.at(-1)?.decl[propiedad];
}

const BOTONES = [
  { nombre: 'contacto por enlace en una respuesta', etiqueta: 'a', clases: ['boton'], ancestros: ['.pas-respuesta', '.formulario'] },
  { nombre: 'contacto por enlace en un bloque', etiqueta: 'a', clases: ['boton'], ancestros: ['.bloque', '.formulario'] },
];

test('el botón de contacto por enlace conserva el color del botón dentro de las respuestas', () => {
  for (const b of BOTONES) {
    assert.equal(valorGanador(b, 'color'), 'var(--pas-acento-texto)', b.nombre);
    assert.equal(valorGanador(b, 'background'), 'var(--pas-acento)', b.nombre);
  }
});

test('los enlaces de texto de las respuestas siguen con el color de acento', () => {
  for (const ancestros of [['.pas-respuesta'], ['.bloque'], ['.pas-respuesta', '.pas-cta']]) {
    assert.equal(valorGanador({ etiqueta: 'a', clases: [], ancestros }, 'color'), 'var(--pas-acento)', ancestros.join(' '));
  }
});

test('en claro y oscuro el texto del botón es distinto de su fondo', () => {
  const temas = [...ESTILOS.matchAll(/--pas-acento:\s*([^;]+);\s*--pas-acento-texto:\s*([^;]+);/g)];
  const claro = ESTILOS.match(/--pas-acento:\s*([^;]+);\s*\n\s*--pas-acento-texto:\s*([^;]+);/);
  const pares = [claro, ...temas].filter(Boolean).map((m) => [m[1].trim(), m[2].trim()]);
  assert.ok(pares.length >= 3, 'tema claro, oscuro y auto');
  for (const [fondo, texto] of pares) assert.notEqual(fondo.toLowerCase(), texto.toLowerCase());
});

test('la especificidad cuenta el argumento de :not()', () => {
  assert.deepEqual(especificidad('.pas-respuesta a:not(.boton)'), [0, 2, 1]);
  assert.deepEqual(especificidad('.boton'), [0, 1, 0]);
});
