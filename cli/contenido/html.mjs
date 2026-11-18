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

/** Markdown en línea a HTML seguro, sin párrafo envolvente. */
export function enLinea(md) {
  const texto = String(md ?? '');
  let salida = '';
  let desde = 0;
  for (const m of texto.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    salida += formato(escapar(texto.slice(desde, m.index)));
    const url = urlSegura(m[2]);
    const etiqueta = formato(escapar(m[1]));
    salida += url ? `<a href="${escapar(url)}">${etiqueta}</a>` : etiqueta;
    desde = m.index + m[0].length;
  }
  return salida + formato(escapar(texto.slice(desde)));
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
 * `sitio.nombre` es el antetítulo por defecto.
 */
export function respuestaHtml(nodo, sitio = {}) {
  const t = esObjeto(nodo.tarjeta) ? nodo.tarjeta : {};
  const variante = nodo.formato === 'tarjeta' ? nodo.variante || 'servicio' : 'texto';
  const partes = [];
  const antetitulo = t.eyebrow ?? sitio.nombre;
  if (antetitulo) partes.push(`<p class="pas-antetitulo">${escapar(antetitulo)}</p>`);
  partes.push(`<h2 class="pas-titulo">${escapar(t.titulo ?? nodo.titulo)}</h2>`);
  partes.push(`<p class="pas-texto">${enLinea(nodo.respuestaCorta)}</p>`);
  partes.push(itemsHtml(variante, t));
  if (Array.isArray(t.etiquetas) && t.etiquetas.length) {
    partes.push(`<ul class="pas-etiquetas" aria-label="Temas">${t.etiquetas.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`);
  }
  const url = esObjeto(t.cta) ? urlSegura(t.cta.destino) : null;
  if (url) partes.push(`<p class="pas-cta"><a href="${escapar(url)}">${escapar(t.cta.texto)}</a></p>`);
  return `<article class="pas-respuesta pas-respuesta--${escapar(variante)}" data-nodo="${escapar(nodo.id)}">${partes.join('')}</article>`;
}
