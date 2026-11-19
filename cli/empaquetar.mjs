// Empaquetado del widget: src/ → dist/pregunta-al-sitio.js (un solo archivo IIFE, sin dependencias).
// `npm run empaquetar` corre este archivo. `build --widget` lo usa para no copiar un script viejo:
// con esbuild instalado (repo de desarrollo) empaqueta; sin esbuild (paquete instalado desde npm)
// comprueba que ningún archivo de src/ sea más reciente que dist/.
import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const SRC = join(RAIZ, 'src');
export const WIDGET = join(RAIZ, 'dist', 'pregunta-al-sitio.js');

export const OPCIONES_ESBUILD = {
  entryPoints: [join(SRC, 'widget', 'index.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  legalComments: 'none',
};

/** esbuild si está instalado (devDependency); null si no. PAS_NO_EMPAQUETAR=1 lo ignora (tests). */
export function cargarEsbuild() {
  if (process.env.PAS_NO_EMPAQUETAR) return null;
  try {
    return createRequire(import.meta.url)('esbuild');
  } catch {
    return null;
  }
}

/** Empaqueta. Con `escribir: false` devuelve el código sin tocar dist/. */
export function empaquetar({ escribir = true, esbuild = cargarEsbuild() } = {}) {
  if (!esbuild) throw new Error('esbuild no está instalado; corre `npm install` en el repo de pregunta-al-sitio');
  const r = esbuild.buildSync({ ...OPCIONES_ESBUILD, outfile: WIDGET, write: escribir });
  return escribir ? WIDGET : r.outputFiles[0].text;
}

function archivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)]));
}

/** Archivos de `src` más recientes que `bundle` (relativos a la raíz). Sin bundle, devuelve ['(falta dist)']. */
export function desactualizados(src = SRC, bundle = WIDGET) {
  if (!existsSync(bundle)) return ['(falta el archivo empaquetado)'];
  const fecha = statSync(bundle).mtimeMs;
  return archivos(src).filter((f) => statSync(f).mtimeMs > fecha).map((f) => relative(join(src, '..'), f).replaceAll('\\', '/'));
}

/**
 * Widget listo para copiar: empaqueta si hay esbuild; si no, falla si dist/ está viejo.
 * Devuelve { ruta, empaquetado }.
 */
export function widgetAlDia() {
  const esbuild = cargarEsbuild();
  if (esbuild) return { ruta: empaquetar({ esbuild }), empaquetado: true };
  const viejos = desactualizados();
  if (viejos.length) {
    throw new Error(
      `${relative(RAIZ, WIDGET)} está desactualizado: ${viejos.slice(0, 3).join(', ')}${viejos.length > 3 ? '…' : ''} ` +
        'es más reciente. Corre `npm run empaquetar` en el repo de pregunta-al-sitio.',
    );
  }
  return { ruta: WIDGET, empaquetado: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`empaquetado ${relative(process.cwd(), empaquetar())}`);
}
