// Carga compartida de la evaluación: índice del sitio, set de preguntas, casos de ámbito y partición.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** Fixture de Playa SPA: el sitio de referencia mientras no exista el ejemplo propio. */
export const FIXTURE_PLAYA = fileURLToPath(new URL('../../tests/fixtures/playa/', import.meta.url));

/** Índice del sitio (indice.json): { version, config, diccionario, nodos, ambito, derivacion }. */
export function cargarIndice(ruta = `${FIXTURE_PLAYA}indice.json`) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

/** Normaliza "esperado" a lista de ids; "contacto" queda como ['contacto']. */
const comoLista = (e) => (Array.isArray(e) ? e : [e]);

export function cargarPreguntas(ruta = `${FIXTURE_PLAYA}preguntas.yaml`) {
  const datos = parse(readFileSync(ruta, 'utf8'));
  return datos.consultas.map((c, i) => ({ ...c, n: i, esperado: comoLista(c.esperado) }));
}

export function cargarCasosAmbito(ruta = `${FIXTURE_PLAYA}casos-ambito.yaml`) {
  return parse(readFileSync(ruta, 'utf8')).casos;
}

/**
 * Partición determinista 60/40, estratificada por tipo: dentro de cada tipo,
 * las posiciones 0, 2 y 4 de cada bloque de cinco van a ajuste y las 1 y 3 a validación.
 */
export function particion(consultas) {
  const vistos = {};
  const ajuste = [];
  const validacion = [];
  for (const c of consultas) {
    const k = (vistos[c.tipo] = (vistos[c.tipo] ?? -1) + 1);
    ([0, 2, 4].includes(k % 5) ? ajuste : validacion).push(c);
  }
  return { ajuste, validacion };
}

/**
 * Consultas que entran en las métricas. Las de tipo seguimiento ("¿y cuánto dura?") dependen del nodo
 * mostrado antes, y el resolvedor responde cada consulta sin contexto: se informan aparte.
 */
export const SIN_METRICAS = ['seguimiento'];
export const medibles = (consultas) => consultas.filter((c) => !SIN_METRICAS.includes(c.tipo));

/** Una consulta espera contacto si su única respuesta aceptable es contacto. */
export const esperaContacto = (c) => c.esperado.length === 1 && c.esperado[0] === 'contacto';

