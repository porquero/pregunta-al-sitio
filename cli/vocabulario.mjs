// vocabulario: palabras frecuentes de las fuentes que el chat no responde.
// Un visitante que escribe una palabra que el documento usa decenas de veces ("evento", "caudal") espera
// una respuesta. Este comando cuenta las palabras de las fuentes, consulta cada una al resolvedor y lista
// las que terminan en contacto (zona baja). Las palabras administrativas que no deben tener nodo se
// declaran en sitio.yaml > vocabulario.ignorar.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { crearResolver } from '../src/motor/resolver.js';
import { normalizar, STOPWORDS } from '../src/motor/normalizar.js';

const EXTENSIONES = /\.(md|markdown|txt)$/i;

function archivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(dir, e.name)) : EXTENSIONES.test(e.name) ? [join(dir, e.name)] : [],
  );
}

/** Texto de las fuentes sin imágenes incrustadas (base64), enlaces ni líneas URL:. */
export function leerFuentes(dirFuentes) {
  if (!existsSync(dirFuentes)) throw new Error(`no existe la carpeta de fuentes ${dirFuentes}`);
  return archivos(dirFuentes)
    .sort()
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
    .replace(/!\[[^\]]*\]\(data:[^)]*\)/g, ' ')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

/** Palabras de `texto` con su número de apariciones: sin tildes, solo letras, sin stopwords. */
export function contarPalabras(texto, { largoMin = 5 } = {}) {
  const cuenta = new Map();
  for (const w of normalizar(texto).split(' ')) {
    if (w.length < largoMin || !/^[a-zñ]+$/.test(w) || STOPWORDS.has(w)) continue;
    cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
  }
  return cuenta;
}

/**
 * Palabras con al menos `min` apariciones en `texto` cuya consulta suelta termina en contacto.
 * `ignorar`: palabras (o frases de una palabra) que el sitio decidió no cubrir.
 */
export function vocabulario(datos, texto, { min = 5, largoMin = 5, ignorar = [] } = {}) {
  const r = crearResolver(datos);
  const omitir = new Set(ignorar.map((x) => normalizar(x)));
  const palabras = [...contarPalabras(texto, { largoMin })]
    .filter(([w, n]) => n >= min && !omitir.has(w))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sinResultado = palabras
    .filter(([w]) => r.resolver(w).zona === 'baja')
    .map(([palabra, veces]) => ({ palabra, veces }));
  return { total: palabras.length, sinResultado };
}
