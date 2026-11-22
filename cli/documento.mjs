// Documento local: cuando sitio.yaml dice `sitio: localhost`, build escribe además un index.html con todos
// los nodos como secciones y el widget dentro. Los enlaces del chat ("Ver más" y los de las respuestas)
// llevan a la sección del nodo (#id), así que se puede navegar el documento desde el chat. Sirve para
// documentos (normas, manuales, resoluciones) que no tienen un sitio web propio. El archivo funciona
// abierto directamente (file://): el índice y el script van incrustados.
//
// Diseño: cabecera, menú lateral fijo con buscador (en el celular, un botón lo despliega), secciones
// agrupadas por tipo de nodo y, en cada una, antetítulo, título, respuesta corta, el cuerpo (plegado si es
// largo) y la fuente. Se configura en sitio.yaml > documento:
//   antetitulo   línea sobre el título (por defecto, ninguna)
//   titulo       título de la página (por defecto, nombre)
//   descripcion  párrafo bajo el título
//   grupos       { tipo: "Nombre del grupo" }: nombre y orden de los grupos; los tipos que falten van
//                después, con el tipo como nombre
//   detalle      texto del botón que despliega un cuerpo largo (por defecto "Texto completo")
//   pie          texto del pie de página (por defecto, nombre)
import { dominiosDe, enLinea, escapar, urlSegura, ENLACE_MD, plegar } from './contenido/html.mjs';

const LOCALES = ['localhost', '127.0.0.1'];

/** Marca del archivo generado: build solo reemplaza un index.html que la tenga. */
export const MARCA = '<meta name="generator" content="pregunta-al-sitio">';

/** Palabras sobre las que el cuerpo se pliega bajo un botón. */
export const PLEGAR_DESDE = 120;

/** ¿El sitio de sitio.yaml es local (localhost o 127.0.0.1)? */
export const esLocal = (sitio) => dominiosDe(sitio).some((d) => LOCALES.includes(d));

/** { ruta, fragmento } de una URL del sitio local: ruta sin ".html", "index.html" ni barra final. */
function partesDe(url) {
  let u;
  try {
    u = new URL(url, 'http://localhost/');
  } catch {
    return null;
  }
  if (!LOCALES.includes(u.hostname)) return null;
  const ruta = decodeURIComponent(u.pathname).replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '').replace(/\/+$/, '');
  return { ruta: ruta || '/', fragmento: decodeURIComponent(u.hash.slice(1)) };
}

/**
 * Convierte enlaces del sitio local en anclas del documento. `nodos`: los nodos que tendrán sección.
 * Un enlace lleva a la sección del nodo cuyo `enlace` es la misma ruta y fragmento ("/rca#cierre"), el
 * mismo fragmento ("#cierre") o, si no, la misma ruta cuando solo un nodo la usa ("/plazos"). Un
 * fragmento que ya es el id de una sección queda tal cual. Si nada coincide, la url no cambia.
 */
export function crearAnclas(nodos, filtro) {
  const ids = new Set(nodos.map((n) => n.id));
  const exacto = new Map();
  const porFragmento = new Map();
  const porRuta = new Map(); // ruta → id, o null si varios nodos comparten la ruta
  for (const n of nodos) {
    const u = n.enlace ? filtro(n.enlace) : null;
    const p = u ? partesDe(u) : null;
    if (!p) continue;
    const clave = `${p.ruta}#${p.fragmento}`;
    if (!exacto.has(clave)) exacto.set(clave, n.id);
    if (p.fragmento && !porFragmento.has(p.fragmento)) porFragmento.set(p.fragmento, n.id);
    porRuta.set(p.ruta, porRuta.has(p.ruta) && porRuta.get(p.ruta) !== n.id ? null : n.id);
  }
  return (u) => {
    if (!u || /^(mailto|tel):/i.test(u)) return u;
    const p = partesDe(u);
    if (!p) return u;
    const delFragmento = p.fragmento ? porFragmento.get(p.fragmento) ?? (ids.has(p.fragmento) ? p.fragmento : null) : null;
    const id = u.startsWith('#') ? delFragmento : exacto.get(`${p.ruta}#${p.fragmento}`) ?? delFragmento ?? porRuta.get(p.ruta);
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
 * Markdown de bloque a HTML seguro: títulos, párrafos, listas, citas, código, tablas, separadores e
 * imágenes. Todo el texto se escapa. Los títulos bajan `nivel` niveles (# → h4 con el valor por defecto:
 * en la página, el grupo es h2 y la sección h3).
 */
export function bloquesHtml(md, opciones = {}) {
  const { nivel: bajar = 3 } = opciones;
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
      const n = Math.min(6, titulo[1].length + bajar);
      salida.push(`<h${n}>${en(titulo[2])}</h${n}>`);
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
const nodoAAncla = (md, ids) =>
  String(md ?? '').replace(ENLACE_MD, (todo, texto, destino) => {
    const id = /^nodo:(.+)$/.exec(destino)?.[1];
    return id && ids.has(id) ? `[${texto}](#${id})` : todo;
  });

/** Texto dentro de <script>: que no cierre la etiqueta ni abra un comentario HTML. */
const enScript = (texto) => texto.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
/** JSON dentro de <script>: "<" como < (válido en JSON y nunca cierra la etiqueta). */
const jsonEnScript = (valor) => JSON.stringify(valor).replace(/</g, '\\u003c');

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const palabras = (md) => String(md ?? '').split(/\s+/).filter(Boolean).length;
const dos = (n) => String(n).padStart(2, '0');

/**
 * Grupos de secciones: los tipos de `documento.grupos` en su orden, con su nombre, y después los demás
 * tipos en el orden en que aparecen, con el tipo como nombre. Devuelve [{ id, titulo, nodos }].
 */
export function gruposDe(nodos, nombres = {}) {
  const tipos = [...Object.keys(nombres ?? {}), ...nodos.map((n) => n.tipo)].filter((t, i, a) => a.indexOf(t) === i);
  return tipos
    .map((tipo) => ({ id: `grupo-${tipo}`, titulo: String(nombres?.[tipo] ?? mayuscula(tipo)), nodos: nodos.filter((n) => n.tipo === tipo) }))
    .filter((g) => g.nodos.length);
}

const ESTILOS = `
:root { --fondo: #f6f7f9; --tarjeta: #fff; --texto: #1b2430; --suave: #5b6675; --linea: #e1e5eb; --acento: #1f4e79;
  --acento-suave: #e8f0f8; --resalte: #fff6d6; --cabecera: #12263a; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --fondo: #0f141b; --tarjeta: #171e28; --texto: #e6eaf0; --suave: #9aa6b6;
  --linea: #2a3442; --acento: #7fb3e6; --acento-suave: #1c2a3a; --resalte: #3a3414; --cabecera: #0a1119; } }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; background: var(--fondo); color: var(--texto); font: 16px/1.65 "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
a { color: var(--acento); }
.saltar { position: absolute; left: -999px; }
.saltar:focus { left: 16px; top: 16px; z-index: 2; background: var(--tarjeta); padding: 8px 12px; border-radius: 6px; }
header { background: var(--cabecera); color: #fff; padding: 36px 16px 32px; }
.ancho { max-width: 1180px; margin: 0 auto; }
.antetitulo { letter-spacing: .14em; text-transform: uppercase; font-size: 12px; opacity: .75; margin: 0 0 8px; }
header h1 { font: 600 clamp(24px, 4vw, 38px)/1.2 Georgia, "Times New Roman", serif; margin: 0 0 10px; }
header p.descripcion { margin: 0; max-width: 760px; opacity: .88; }
.diseno { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 32px; max-width: 1180px; margin: 0 auto; padding: 28px 16px 96px; }
nav { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow: auto; padding-right: 8px; font-size: 14px; }
nav input { width: 100%; padding: 9px 12px; border: 1px solid var(--linea); border-radius: 8px; background: var(--tarjeta); color: var(--texto); font: inherit; margin-bottom: 14px; }
.grupo-menu > p { font-weight: 600; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--suave); margin: 16px 0 6px; }
nav ul { list-style: none; margin: 0; padding: 0; }
nav li a { display: block; padding: 5px 10px; border-radius: 6px; color: var(--texto); text-decoration: none; line-height: 1.35; }
nav li a:hover, nav li a[aria-current="true"] { background: var(--acento-suave); color: var(--acento); }
.sin-resultados { color: var(--suave); margin: 8px 10px; }
#menu { display: none; }
main h2 { font: 600 13px/1.2 "Segoe UI", system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--suave); margin: 40px 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--linea); }
main h2:first-child { margin-top: 0; }
.seccion { background: var(--tarjeta); border: 1px solid var(--linea); border-radius: 12px; padding: 24px 26px; margin: 0 0 18px; scroll-margin-top: 16px; transition: background .3s, box-shadow .3s; }
.seccion:target { background: var(--resalte); box-shadow: 0 0 0 2px var(--acento); }
.ceja { margin: 0 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--acento); font-weight: 600; }
.seccion h3 { font: 600 22px/1.3 Georgia, "Times New Roman", serif; margin: 0 0 12px; }
.resumen { margin: 0 0 14px; font-size: 17px; }
.cuerpo { font-size: 15px; }
.cuerpo p { margin: 0 0 10px; overflow-wrap: anywhere; }
.cuerpo h4, .cuerpo h5, .cuerpo h6 { margin: 18px 0 8px; font-size: 15px; }
details { border-top: 1px solid var(--linea); padding-top: 10px; }
summary { cursor: pointer; font-weight: 600; color: var(--acento); font-size: 15px; padding: 4px 0; }
details .cuerpo { margin-top: 10px; }
.tabla { overflow-x: auto; margin: 8px 0 14px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { border: 1px solid var(--linea); padding: 8px 10px; text-align: left; vertical-align: top; }
th { background: var(--acento-suave); font-weight: 600; }
.cuerpo ul, .cuerpo ol { margin: 0 0 12px; padding-left: 22px; }
blockquote { margin: 0 0 14px; background: var(--acento-suave); border-left: 3px solid var(--acento); padding: 10px 14px; border-radius: 0 8px 8px 0; }
blockquote p:last-child { margin-bottom: 0; }
pre { overflow-x: auto; padding: 12px; border: 1px solid var(--linea); border-radius: 8px; font-size: 14px; }
img { max-width: 100%; height: auto; }
.fuente { margin: 14px 0 0; font-size: 13px; color: var(--suave); }
footer { border-top: 1px solid var(--linea); padding: 22px 16px; text-align: center; color: var(--suave); font-size: 13px; }
@media (max-width: 900px) {
  .diseno { grid-template-columns: 1fr; gap: 12px; }
  nav { position: static; max-height: none; padding-right: 0; }
  #menu { display: block; width: 100%; padding: 10px; border: 1px solid var(--linea); border-radius: 8px; background: var(--tarjeta); color: var(--texto); font: inherit; font-size: 15px; font-weight: 600; margin-bottom: 10px; cursor: pointer; }
  nav:not(.abierto) .menu-cuerpo { display: none; }
  .seccion { padding: 18px; }
}
@media print {
  nav, #menu, pregunta-al-sitio { display: none; }
  .diseno { display: block; }
  .seccion { break-inside: avoid; box-shadow: none; }
  details:not([open]) > .cuerpo { display: block; }
}`;

// Menú: botón en el celular, buscador por título y palabras clave, sección actual marcada, y el cuerpo
// plegado se abre al llegar a su sección (también desde "Ver más" del chat).
const GUION = `(function () {
  var nav = document.querySelector('nav');
  var menu = document.getElementById('menu');
  menu.addEventListener('click', function () {
    var abierto = nav.classList.toggle('abierto');
    menu.setAttribute('aria-expanded', String(abierto));
  });
  function abrir() {
    var id = decodeURIComponent(location.hash.slice(1));
    var s = id && document.getElementById(id);
    var d = s && s.querySelector('details');
    if (d) d.open = true;
  }
  window.addEventListener('hashchange', abrir);
  abrir();
  var plegar = function (t) { return t.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); };
  var buscador = document.getElementById('buscar');
  var vacio = document.querySelector('.sin-resultados');
  buscador.addEventListener('input', function () {
    var v = plegar(buscador.value.trim());
    var hay = 0;
    document.querySelectorAll('.grupo-menu').forEach(function (g) {
      var visibles = 0;
      g.querySelectorAll('li').forEach(function (li) {
        var si = !v || plegar(li.textContent + ' ' + (li.dataset.buscar || '')).indexOf(v) > -1;
        li.hidden = !si;
        if (si) visibles += 1;
      });
      g.hidden = !visibles;
      hay += visibles;
    });
    vacio.hidden = hay > 0;
  });
  var enlaces = [].slice.call(document.querySelectorAll('nav li a'));
  enlaces.forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('abierto'); menu.setAttribute('aria-expanded', 'false'); });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        enlaces.forEach(function (a) {
          if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.seccion').forEach(function (s) { io.observe(s); });
  }
})();`;

/**
 * index.html del documento local.
 *   indice   el índice que arma build (va incrustado)
 *   nodos    las secciones (seccionesDe), con respuestaCorta, cuerpo en Markdown y fuente
 *   sitio    sitio.yaml (nombre y documento)
 *   widget   el código de pregunta-al-sitio.js
 *   url      filtro de enlaces del índice (con anclas)
 */
export function paginaLocal({ indice, nodos, sitio = {}, widget, url = urlSegura }) {
  const doc = sitio.documento && typeof sitio.documento === 'object' ? sitio.documento : {};
  const ids = new Set(nodos.map((n) => n.id));
  const opciones = { url, existe: () => false };
  const nombre = String(sitio.nombre ?? 'Documento');
  const titulo = String(doc.titulo ?? nombre);
  const grupos = gruposDe(nodos, doc.grupos);

  const menu = grupos
    .map(
      (g) =>
        `<div class="grupo-menu"><p>${escapar(g.titulo)}</p><ul>${g.nodos
          .map((n) => `<li data-buscar="${escapar(plegar((n.keywords ?? []).join(' ')))}"><a href="#${escapar(n.id)}">${escapar(n.titulo)}</a></li>`)
          .join('')}</ul></div>`,
    )
    .join('\n');

  const seccion = (n, g, i) => {
    const id = escapar(n.id);
    const partes = [`<p class="ceja">${escapar(g.titulo)} · ${dos(i + 1)}</p>`, `<h3 id="t-${id}">${escapar(n.titulo)}</h3>`];
    partes.push(`<p class="resumen">${linea(nodoAAncla(n.respuestaCorta, ids), opciones)}</p>`);
    if (n.cuerpo) {
      const cuerpo = `<div class="cuerpo">${bloquesHtml(nodoAAncla(n.cuerpo, ids), opciones)}</div>`;
      partes.push(palabras(n.cuerpo) > PLEGAR_DESDE ? `<details><summary>${escapar(doc.detalle ?? 'Texto completo')}</summary>${cuerpo}</details>` : cuerpo);
    }
    if (n.fuente) partes.push(`<p class="fuente">Fuente: ${escapar(n.fuente)}</p>`);
    return `<section class="seccion" id="${id}" aria-labelledby="t-${id}">${partes.join('\n')}</section>`;
  };
  const contenido = grupos.map((g) => `<h2 id="${escapar(g.id)}">${escapar(g.titulo)}</h2>\n${g.nodos.map((n, i) => seccion(n, g, i)).join('\n')}`).join('\n');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${MARCA}
<title>${escapar(titulo === nombre ? nombre : `${nombre} · ${titulo}`)}</title>
${doc.descripcion ? `<meta name="description" content="${escapar(doc.descripcion)}">\n` : ''}<style>${ESTILOS}
</style>
</head>
<body>
<a class="saltar" href="#contenido">Ir al contenido</a>
<header><div class="ancho">
${doc.antetitulo ? `<p class="antetitulo">${escapar(doc.antetitulo)}</p>\n` : ''}<h1>${escapar(titulo)}</h1>
${doc.descripcion ? `<p class="descripcion">${escapar(doc.descripcion)}</p>\n` : ''}</div></header>
<div class="diseno">
<nav aria-label="Índice">
<button id="menu" type="button" aria-expanded="false" aria-controls="menu-cuerpo">Índice de secciones</button>
<div class="menu-cuerpo" id="menu-cuerpo">
<input id="buscar" type="search" placeholder="Buscar sección…" aria-label="Buscar sección" autocomplete="off">
${menu}
<p class="sin-resultados" hidden>Ninguna sección coincide.</p>
</div>
</nav>
<main id="contenido">
${contenido}
</main>
</div>
<footer>${escapar(doc.pie ?? nombre)}</footer>
<script>
${GUION}
</script>
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
