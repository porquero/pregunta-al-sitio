// HTML de la respuesta de un nodo. Todo el texto se escapa; la respuesta corta admite Markdown en
// línea (enlaces, negrita, cursiva y código). El widget lo inserta tal cual, así que solo se emiten
// etiquetas y atributos conocidos.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

/** Solo enlaces http(s), mailto, tel y relativos. */
export function urlSegura(url) {
  const u = String(url ?? '').trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (/^(\/(?!\/)|#|\.\.?\/)/.test(u)) return u;
  return null;
}

function formato(escapado) {
  return escapado
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

/** Enlace que abre otro nodo en el chat, sin salir de la página. El widget atiende `a[data-nodo]`. */
export const enlaceNodo = (id, etiquetaHtml) => `<a href="#" role="button" data-nodo="${escapar(id)}">${etiquetaHtml}</a>`;

/** Enlaces Markdown: [texto](url). Con "nodo:id" el destino es otro nodo del chat. */
export const ENLACE_MD = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const NODO = /^nodo:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Ids de los enlaces nodo: de un texto Markdown. */
export const idsEnlazados = (md) => [...String(md ?? '').matchAll(ENLACE_MD)].map((m) => NODO.exec(m[2])?.[1]).filter(Boolean);

/** Texto visible de un Markdown en línea: los enlaces quedan como su etiqueta. */
export const textoVisible = (md) => String(md ?? '').replace(ENLACE_MD, '$1');

// Tramos que el autoenlace no toca: código, negrita y cursiva explícitas.
const PROTEGIDO = /`[^`]+`|\*\*[^*]+\*\*|(?<![*\w])\*[^*\s][^*]*\*/gu;
const LETRA = /[\p{L}\p{N}]/u;

/** Minúsculas y sin tildes, carácter a carácter: conserva las posiciones del texto original. */
const plegar = (t) => [...t].map((c) => (c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()[0] ?? c)).join('');
const escaparRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Prepara el autoenlace de un sitio.
 *   nombres  [{ nombre, id, enlace }]: los nombres enlazables de cada nodo del chat
 *   max      autoenlaces por respuesta
 *   destino  null (enlace https externo o, si no, el nodo), 'enlace' o 'nodo'
 * Devuelve una función (texto plano, id del nodo, estado) → HTML, o null si no hay nombres.
 */
export function crearAutoenlace({ nombres = [], max = 5, destino = null } = {}) {
  const porNombre = new Map();
  for (const n of nombres) {
    const clave = plegar(String(n.nombre ?? '').trim());
    if (clave && !porNombre.has(clave)) porNombre.set(clave, n);
  }
  if (!porNombre.size || max <= 0) return null;
  // La alternativa más larga primero: ante nombres solapados gana el más largo.
  const claves = [...porNombre.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${claves.map(escaparRe).join('|')})(?![\\p{L}\\p{N}])`, 'gu');

  const enlace = (n, etiqueta) => {
    const externo = /^https:\/\//i.test(n.enlace ?? '');
    const url = urlSegura(n.enlace);
    if (url && (destino === 'enlace' || (destino !== 'nodo' && externo))) {
      return externo
        ? `<a href="${escapar(url)}" target="_blank" rel="noopener">${etiqueta}</a>`
        : `<a href="${escapar(url)}">${etiqueta}</a>`;
    }
    return enlaceNodo(n.id, etiqueta);
  };

  return (texto, propio, estado) => {
    let salida = '';
    let desde = 0;
    for (const m of plegar(texto).matchAll(re)) {
      const n = porNombre.get(m[0]);
      // El propio nodo y los ya enlazados consumen la mención sin enlazarla.
      if (n.id === propio || estado.enlazados.has(n.id) || estado.autoenlaces >= max) continue;
      estado.enlazados.add(n.id);
      estado.autoenlaces += 1;
      salida += escapar(texto.slice(desde, m.index)) + enlace(n, escapar(texto.slice(m.index, m.index + m[0].length)));
      desde = m.index + m[0].length;
    }
    return salida + escapar(texto.slice(desde));
  };
}

/** Texto sin enlaces Markdown: formato explícito y, si hay, autoenlace fuera de los tramos protegidos. */
function tramo(texto, contexto) {
  const { autoenlace, id, estado } = contexto;
  if (!autoenlace) return formato(escapar(texto));
  let salida = '';
  let desde = 0;
  for (const m of texto.matchAll(PROTEGIDO)) {
    salida += autoenlace(texto.slice(desde, m.index), id, estado) + formato(escapar(m[0]));
    desde = m.index + m[0].length;
  }
  return salida + autoenlace(texto.slice(desde), id, estado);
}

/**
 * Markdown en línea a HTML seguro, sin párrafo envolvente.
 * opciones.existe(id) dice si un enlace nodo: tiene destino en el chat (sin destino queda como texto);
 * opciones.autoenlace (de crearAutoenlace) y opciones.id enlazan la primera mención de otros nodos.
 */
export function enLinea(md, { existe = () => true, autoenlace = null, id = null } = {}) {
  const texto = String(md ?? '');
  const contexto = { autoenlace, id, estado: { enlazados: new Set(), autoenlaces: 0 } };
  let salida = '';
  let desde = 0;
  for (const m of texto.matchAll(ENLACE_MD)) {
    salida += tramo(texto.slice(desde, m.index), contexto);
    const etiqueta = formato(escapar(m[1]));
    const nodo = NODO.exec(m[2])?.[1];
    const url = nodo ? null : urlSegura(m[2]);
    if (nodo && existe(nodo)) {
      salida += enlaceNodo(nodo, etiqueta);
      contexto.estado.enlazados.add(nodo); // Ya enlazado a mano: el autoenlace no lo repite.
    } else salida += url ? `<a href="${escapar(url)}">${etiqueta}</a>` : etiqueta;
    desde = m.index + m[0].length;
  }
  return salida + tramo(texto.slice(desde), contexto);
}

const esObjeto = (v) => v !== null && typeof v === 'object';

function itemsHtml(variante, t) {
  const items = Array.isArray(t.items) ? t.items : [];
  const cifras = Array.isArray(t.cifras) ? t.cifras : [];
  if (variante === 'proceso' && items.length) {
    return `<ol class="pas-pasos">${items.map((i) => `<li>${escapar(esObjeto(i) ? i.titulo : i)}</li>`).join('')}</ol>`;
  }
  if (variante === 'cifras' && cifras.length) {
    const celdas = cifras.map(
      (c) =>
        `<div class="pas-cifra"><p class="pas-cifra__numero">${escapar(c?.numero ?? c?.valor ?? '')}</p>` +
        `<p class="pas-cifra__etiqueta">${escapar(c?.etiqueta ?? '')}</p></div>`,
    );
    return `<div class="pas-cifras">${celdas.join('')}</div>`;
  }
  if (!items.length) return '';
  if (esObjeto(items[0])) {
    const filas = items.map((i) => {
      const url = urlSegura(i?.ruta);
      const titulo = url ? `<a href="${escapar(url)}">${escapar(i.titulo)}</a>` : escapar(i?.titulo);
      return `<div><dt>${titulo}</dt>${i?.texto ? `<dd>${escapar(i.texto)}</dd>` : ''}</div>`;
    });
    return `<dl class="pas-datos">${filas.join('')}</dl>`;
  }
  return `<ul class="pas-items">${items.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}

/**
 * Bloque de respuesta del nodo: antetítulo, título, respuesta corta y lo que traiga la tarjeta
 * (items, cifras, etiquetas, llamado a la acción). Los chips y "Ver más" los dibuja el widget.
 * `sitio.nombre` es el antetítulo por defecto. `enlaces` son las opciones de enLinea (existe, autoenlace).
 */
export function respuestaHtml(nodo, sitio = {}, enlaces = {}) {
  const t = esObjeto(nodo.tarjeta) ? nodo.tarjeta : {};
  const variante = nodo.formato === 'tarjeta' ? nodo.variante || 'servicio' : 'texto';
  const partes = [];
  const antetitulo = t.eyebrow ?? sitio.nombre;
  if (antetitulo) partes.push(`<p class="pas-antetitulo">${escapar(antetitulo)}</p>`);
  partes.push(`<h2 class="pas-titulo">${escapar(t.titulo ?? nodo.titulo)}</h2>`);
  partes.push(`<p class="pas-texto">${enLinea(nodo.respuestaCorta, { ...enlaces, id: nodo.id })}</p>`);
  partes.push(itemsHtml(variante, t));
  if (Array.isArray(t.etiquetas) && t.etiquetas.length) {
    partes.push(`<ul class="pas-etiquetas" aria-label="Temas">${t.etiquetas.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`);
  }
  const url = esObjeto(t.cta) ? urlSegura(t.cta.destino) : null;
  if (url) partes.push(`<p class="pas-cta"><a href="${escapar(url)}">${escapar(t.cta.texto)}</a></p>`);
  return `<article class="pas-respuesta pas-respuesta--${escapar(variante)}" data-nodo="${escapar(nodo.id)}">${partes.join('')}</article>`;
}
