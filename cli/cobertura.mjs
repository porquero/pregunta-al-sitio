// cobertura: regla "una fuente con URL: es un nodo".
// Toda fuente (.md, .txt, .markdown) con una línea "URL: …" es una página publicada y debe tener al
// menos un nodo cuyo `enlace` sea esa URL. Las excepciones (duplicado exacto, página que se pidió
// excluir) se listan en sitio.yaml > cobertura.excluir.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { leerSitio, leerNodos } from './contenido/leer.mjs';
import { dominiosDe } from './contenido/html.mjs';

const EXTENSIONES = /\.(md|markdown|txt)$/i;
const LINEA_URL = /^[ \t>*_-]*URL:[ \t*_]*<?(\S+?)>?[ \t*_]*$/im;

function archivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(dir, e.name)) : EXTENSIONES.test(e.name) ? [join(dir, e.name)] : [],
  );
}

/** Ruta sin barra final; con normalizar, también sin "index.html" ni ".html". */
function limpiarRuta(ruta, normalizar) {
  let r = ruta;
  if (normalizar) r = r.replace(/(^|\/)index\.html?$/i, '$1').replace(/\.html?$/i, '');
  return r.replace(/\/+$/, '') || '/';
}

/**
 * Clave para comparar URL: host sin "www." y ruta sin barra final, sin esquema, consulta ni ancla.
 * Una ruta relativa (/tours) se compara con la ruta de las URL del sitio.
 * opciones.normalizar además quita ".html" e "index.html" (páginas guardadas con wget que el sitio
 * publica sin extensión).
 */
export function claveUrl(url, { normalizar = false } = {}) {
  const u = String(url ?? '').trim();
  if (!u) return null;
  if (u.startsWith('/')) return { host: null, ruta: limpiarRuta(u.split(/[?#]/)[0], normalizar) };
  try {
    const x = new URL(/^[a-z]+:\/\//i.test(u) ? u : `https://${u}`);
    return { host: x.hostname.toLowerCase().replace(/^www\./, ''), ruta: limpiarRuta(decodeURI(x.pathname), normalizar) };
  } catch {
    return null;
  }
}

/** ¿El enlace de un nodo apunta a la URL de la fuente? Las rutas relativas valen para los dominios del sitio. */
function coincide(fuente, enlace, dominios) {
  if (!fuente || !enlace || fuente.ruta !== enlace.ruta) return false;
  if (enlace.host) return enlace.host === fuente.host;
  return !dominios.length || dominios.some((d) => fuente.host === d || fuente.host.endsWith(`.${d}`));
}

/** Fuentes con URL y las que no tienen nodo. opciones.normalizar: ver claveUrl. */
export function cobertura(dirContenido, dirFuentes, { normalizar = false } = {}) {
  if (!existsSync(dirFuentes)) throw new Error(`no existe la carpeta de fuentes ${dirFuentes}`);
  const clave = (u) => claveUrl(u, { normalizar });
  const sitio = leerSitio(dirContenido);
  const { nodos } = leerNodos(dirContenido);
  const dominios = dominiosDe(sitio.sitio);
  const enlaces = nodos.map((n) => ({ id: n.id, clave: clave(n.enlace) })).filter((n) => n.clave);
  const excluir = (sitio.cobertura?.excluir ?? []).map(clave).filter(Boolean);

  const fuentes = [];
  for (const archivo of archivos(dirFuentes).sort()) {
    const m = LINEA_URL.exec(readFileSync(archivo, 'utf8'));
    if (!m) continue;
    const propia = clave(m[1]);
    fuentes.push({
      archivo: relative(dirFuentes, archivo).replaceAll('\\', '/'),
      url: m[1],
      nodos: enlaces.filter((e) => coincide(propia, e.clave, dominios)).map((e) => e.id),
      excluida: excluir.some((x) => x.host === propia?.host && x.ruta === propia?.ruta),
    });
  }
  return { fuentes, sinNodo: fuentes.filter((f) => !f.nodos.length && !f.excluida) };
}
