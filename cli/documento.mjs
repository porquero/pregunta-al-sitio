// Documento local: cuando sitio.yaml dice `sitio: localhost`, build escribe además un index.html con todos
// los nodos como secciones y el widget dentro. Los enlaces del chat ("Ver más" y los de las respuestas)
// llevan a la sección del nodo (#id), así que se puede navegar el documento desde el chat. Sirve para
// documentos (normas, manuales, informes) que no tienen un sitio web propio. El archivo funciona abierto
// directamente (file://): el índice y el script van incrustados.
import { dominiosDe, enLinea, escapar, urlSegura, ENLACE_MD } from './contenido/html.mjs';

const LOCALES = ['localhost', '127.0.0.1'];

/** Marca del archivo generado: build solo reemplaza un index.html que la tenga. */
export const MARCA = '<meta name="generator" content="pregunta-al-sitio">';

/** ¿El sitio de sitio.yaml es local (localhost o 127.0.0.1)? */
export const esLocal = (sitio) => dominiosDe(sitio).some((d) => LOCALES.includes(d));

/** Ruta comparable: sin ".html", "index.html", barra final ni fragmento. */
function rutaDe(url) {
  let u;
  try {
    u = new URL(url, 'http://localhost/');
  } catch {
    return null;
  }
  if (!LOCALES.includes(u.hostname)) return null;
  const ruta = decodeURIComponent(u.pathname).replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '').replace(/\/+$/, '');
  return ruta || '/';
}

/**
 * Convierte enlaces del sitio local en anclas del documento. `nodos`: los nodos que tendrán sección.
 * Devuelve (url filtrada o null) → "#id" si la ruta es el `enlace` de un nodo; si no, la url tal cual.
 */
export function crearAnclas(nodos, filtro) {
  const porRuta = new Map();
  for (const n of nodos) {
    const u = n.enlace ? filtro(n.enlace) : null;
    const ruta = u && !u.startsWith('#') ? rutaDe(u) : null;
    if (ruta && !porRuta.has(ruta)) porRuta.set(ruta, n.id);
  }
  return (u) => {
    if (!u || u.startsWith('#') || /^(mailto|tel):/i.test(u)) return u;
    const id = porRuta.get(rutaDe(u));
    return id ? `#${id}` : u;
  };
}

/** Nodos que van como sección del documento: los visibles, salvo el saludo. */
export const seccionesDe = (nodos) => nodos.filter((n) => n.tipo !== 'saludo');

const IMAGEN = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const IMAGEN_DATOS = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i;

/** Una línea Markdown en línea: imágenes aparte (enLinea las leería como enlaces) y el resto con enLinea. */
function linea(md, opciones) {
  let salida = '';
  let desde = 0;
  for (const m of md.matchAll(IMAGEN)) {
    salida += enLinea(md.slice(desde, m.index), opciones);
    const src = IMAGEN_DATOS.test(m[2]) ? m[2] : urlSegura(m[2]);
    salida += src ? `<img src="${escapar(src)}" alt="${escapar(m[1])}" loading="lazy">` : escapar(m[1]);
    desde = m.index + m[0].length;
  }
  return salida + enLinea(md.slice(desde), opciones);
}

const celdas = (fila) => fila.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const esSeparadorTabla = (fila) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(fila);

/**
 * Markdown de bloque a HTML seguro: títulos (bajan dos niveles: la sección ya es h2), párrafos, listas,
 * citas, código, tablas, separadores e imágenes. Todo el texto se escapa.
 */
export function bloquesHtml(md, opciones = {}) {
  const lineas = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const salida = [];
  let i = 0;
  const en = (t) => linea(t, opciones);
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) {
      i += 1;
      continue;
    }
    const cerca = /^\s*(```|~~~)/.exec(l);
    if (cerca) {
      const codigo = [];
      i += 1;
      while (i < lineas.length && !lineas[i].trim().startsWith(cerca[1])) codigo.push(lineas[i++]);
      i += 1;
      salida.push(`<pre><code>${escapar(codigo.join('\n'))}</code></pre>`);
      continue;
    }
    const titulo = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (titulo) {
      const nivel = Math.min(6, titulo[1].length + 2);
      salida.push(`<h${nivel}>${en(titulo[2])}</h${nivel}>`);
      i += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
      salida.push('<hr>');
      i += 1;
      continue;
    }
    if (l.includes('|') && i + 1 < lineas.length && esSeparadorTabla(lineas[i + 1])) {
      const cabecera = celdas(l);
      i += 2;
      const filas = [];
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) filas.push(celdas(lineas[i++]));
      salida.push(
        `<div class="tabla"><table><thead><tr>${cabecera.map((c) => `<th>${en(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${en(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (/^\s*>/.test(l)) {
      const cita = [];
      while (i < lineas.length && /^\s*>/.test(lineas[i])) cita.push(lineas[i++].replace(/^\s*>\s?/, ''));
      salida.push(`<blockquote>${bloquesHtml(cita.join('\n'), opciones)}</blockquote>`);
      continue;
    }
    const item = /^\s*([-*+]|\d+[.)])\s+/;
    if (item.test(l)) {
      const ordenada = /^\s*\d/.test(l);
      const items = [];
      while (i < lineas.length && lineas[i].trim() && !/^\s*(#{1,6}\s|```|~~~|>)/.test(lineas[i])) {
        if (item.test(lineas[i])) items.push(lineas[i].replace(item, ''));
        else items[items.length - 1] += ` ${lineas[i].trim()}`; // Continuación del ítem anterior.
        i += 1;
      }
      const tag = ordenada ? 'ol' : 'ul';
      salida.push(`<${tag}>${items.map((t) => `<li>${en(t)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() && !/^\s*(#{1,6}\s|```|~~~|>|([-*+]|\d+[.)])\s)/.test(lineas[i])) parrafo.push(lineas[i++].trim());
    if (!parrafo.length) parrafo.push(lineas[i++].trim());
    salida.push(`<p>${en(parrafo.join(' '))}</p>`);
  }
  return salida.join('\n');
}

/** Enlaces nodo:id del Markdown como anclas de la página (data-nodo solo funciona dentro del chat). */
const nodoAAncla = (md, ids) => String(md ?? '').replace(ENLACE_MD, (todo, texto, destino) => {
  const id = /^nodo:(.+)$/.exec(destino)?.[1];
  return id && ids.has(id) ? `[${texto}](#${id})` : todo;
});

/** Texto dentro de <script>: que no cierre la etiqueta ni abra un comentario HTML. */
const enScript = (texto) => texto.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
/** JSON dentro de <script>: "<" como < (válido en JSON y nunca cierra la etiqueta). */
const jsonEnScript = (valor) => JSON.stringify(valor).replace(/</g, '\\u003c');

/**
 * index.html del documento local.
 *   indice   el índice que arma build (va incrustado)
 *   nodos    las secciones (seccionesDe), con respuestaCorta y cuerpo en Markdown
 *   sitio    sitio.yaml (nombre)
 *   widget   el código de pregunta-al-sitio.js
 *   url      filtro de enlaces del índice (con anclas)
 */
export function paginaLocal({ indice, nodos, sitio = {}, widget, url = urlSegura }) {
  const ids = new Set(nodos.map((n) => n.id));
  const opciones = { url, existe: () => false };
  const nombre = sitio.nombre ?? 'Documento';
  const indiceNav = nodos.map((n) => `<li><a href="#${escapar(n.id)}">${escapar(n.titulo)}</a></li>`).join('');
  const secciones = nodos
    .map((n) => {
      const corta = `<p class="resumen">${linea(nodoAAncla(n.respuestaCorta, ids), opciones)}</p>`;
      const cuerpo = n.cuerpo ? bloquesHtml(nodoAAncla(n.cuerpo, ids), opciones) : '';
      return `<section id="${escapar(n.id)}">\n<h2>${escapar(n.titulo)}</h2>\n${corta}\n${cuerpo}\n<p class="arriba"><a href="#contenido">Volver al índice</a></p>\n</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${MARCA}
<title>${escapar(nombre)}</title>
<style>
:root { color-scheme: light dark; --texto: #1d1d1f; --suave: #5f6368; --fondo: #fff; --borde: #e3e3e6; --acento: #0b57d0; }
@media (prefers-color-scheme: dark) { :root { --texto: #e8e8ea; --suave: #a0a3a8; --fondo: #161618; --borde: #34343a; --acento: #8ab4f8; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fondo); color: var(--texto); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 6rem; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 1.5rem; }
h2 { font-size: 1.45rem; line-height: 1.3; margin: 0 0 .75rem; }
section { padding-top: 2.5rem; margin-top: 2.5rem; border-top: 1px solid var(--borde); scroll-margin-top: 1rem; }
section:target h2 { color: var(--acento); }
a { color: var(--acento); }
nav ol { padding-left: 1.25rem; }
.resumen { font-size: 1.05rem; }
.arriba { font-size: .875rem; color: var(--suave); }
img { max-width: 100%; height: auto; }
pre { overflow-x: auto; padding: .75rem; border: 1px solid var(--borde); border-radius: 6px; }
blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid var(--borde); color: var(--suave); }
.tabla { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: .95rem; }
th, td { border: 1px solid var(--borde); padding: .4rem .6rem; text-align: left; vertical-align: top; }
</style>
</head>
<body>
<main>
<h1>${escapar(nombre)}</h1>
<nav id="contenido" aria-label="Índice"><ol>${indiceNav}</ol></nav>
${secciones}
</main>
<script type="application/json" id="pas-indice">${jsonEnScript(indice)}</script>
<script>
window.PreguntaAlSitioConfig = { indice: 'data:application/json;charset=utf-8,' + encodeURIComponent(document.getElementById('pas-indice').textContent) };
</script>
<script>
${enScript(widget)}
</script>
</body>
</html>
`;
}
