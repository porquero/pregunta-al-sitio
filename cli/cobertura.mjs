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

/**
 * Clave para comparar URL: host sin "www." y ruta sin barra final, sin esquema, consulta ni ancla.
 * Una ruta relativa (/tours) se compara con la ruta de las URL del sitio.
 */
export function claveUrl(url) {
  const u = String(url ?? '').trim();
  if (!u) return null;
  if (u.startsWith('/')) return { host: null, ruta: u.split(/[?#]/)[0].replace(/\/+$/, '') || '/' };
  try {
    const x = new URL(/^[a-z]+:\/\//i.test(u) ? u : `https://${u}`);
    return { host: x.hostname.toLowerCase().replace(/^www\./, ''), ruta: decodeURI(x.pathname).replace(/\/+$/, '') || '/' };
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

/** Fuentes con URL y las que no tienen nodo. */
export function cobertura(dirContenido, dirFuentes) {
  if (!existsSync(dirFuentes)) throw new Error(`no existe la carpeta de fuentes ${dirFuentes}`);
  const sitio = leerSitio(dirContenido);
  const { nodos } = leerNodos(dirContenido);
  const dominios = dominiosDe(sitio.sitio);
  const enlaces = nodos.map((n) => ({ id: n.id, clave: claveUrl(n.enlace) })).filter((n) => n.clave);
  const excluir = (sitio.cobertura?.excluir ?? []).map(claveUrl).filter(Boolean);

  const fuentes = [];
  for (const archivo of archivos(dirFuentes).sort()) {
    const m = LINEA_URL.exec(readFileSync(archivo, 'utf8'));
    if (!m) continue;
    const clave = claveUrl(m[1]);
    fuentes.push({
      archivo: relative(dirFuentes, archivo).replaceAll('\\', '/'),
      url: m[1],
      nodos: enlaces.filter((e) => coincide(clave, e.clave, dominios)).map((e) => e.id),
      excluida: excluir.some((x) => x.host === clave?.host && x.ruta === clave?.ruta),
    });
  }
  return { fuentes, sinNodo: fuentes.filter((f) => !f.nodos.length && !f.excluida) };
}
