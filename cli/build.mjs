// build: contenido del sitio (sitio.yaml + nodos/*.md) → indice.json estático para el motor y el widget.
import { createHash } from 'node:crypto';
import { leerSitio, leerNodos, nombresEnlazables } from './contenido/leer.mjs';
import { respuestaHtml, crearAutoenlace } from './contenido/html.mjs';

const MAX_CHIPS = 4;
const MAX_CHIPS_ARISTAS = 3;

/** Nombre corto para chips: el título hasta la primera coma. */
const tituloCorto = (n) => n.titulo.split(',')[0].trim();

/**
 * Chips de seguimiento. Si el nodo declara chips, se usan esos: con destino abren ese nodo y sin destino
 * consultan su texto al motor. Si no declara, se ofrecen los destinos de sus aristas de mayor peso.
 */
function seguimientoDe(nodo, porId) {
  if (nodo.chips.length) {
    return nodo.chips.slice(0, MAX_CHIPS).map((c) => (c.a ? { texto: c.texto, nodo: c.a } : { texto: c.texto, q: c.texto }));
  }
  const salida = [];
  for (const a of [...nodo.aristas].sort((x, y) => y.peso - x.peso)) {
    const destino = porId.get(a.a);
    if (!destino || destino.id === nodo.id || salida.some((s) => s.nodo === destino.id)) continue;
    salida.push({ texto: tituloCorto(destino), nodo: destino.id });
    if (salida.length === MAX_CHIPS_ARISTAS) break;
  }
  return salida;
}

/**
 * Arma el índice a partir de la carpeta del sitio.
 * opciones.borradores incluye los nodos en estado borrador (para evaluar antes de aprobar).
 * Devuelve { indice, errores }; con errores de lectura el índice se arma igual con lo que se pudo leer.
 */
export function construirIndice(dir, { borradores = false } = {}) {
  const sitio = leerSitio(dir);
  const { nodos: todos, errores } = leerNodos(dir);
  const visibles = todos.filter((n) => borradores || n.estado === 'aprobado');
  const enChat = visibles.filter((n) => n.enChat);
  const porId = new Map(enChat.map((n) => [n.id, n]));
  const enlaces = {
    existe: (id) => porId.has(id),
    autoenlace: sitio.autoenlazar
      ? crearAutoenlace({
          nombres: enChat.flatMap((n) => nombresEnlazables(n).map((nombre) => ({ nombre, id: n.id, enlace: n.enlace }))),
          max: sitio.autoenlazar_max ?? 5,
          destino: sitio.autoenlazar_destino ?? null,
        })
      : null,
  };

  const nodos = enChat.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    formato: n.formato,
    variante: n.variante,
    titulo: n.titulo,
    preguntas: n.preguntas,
    keywords: n.keywords,
    sinonimos: n.sinonimos,
    // Solo aristas hacia nodos que el chat puede mostrar.
    aristas: n.aristas.filter((a) => porId.has(a.a)),
    chips: n.chips.map((c) => (c.a ? { texto: c.texto, a: c.a } : c.texto)),
    enlace: n.enlace,
    seguimiento: seguimientoDe(n, porId),
    respuesta: respuestaHtml(n, sitio, enlaces),
  }));

  // El texto de derivación se escribe en el nodo contacto.
  const derivacion = visibles.find((n) => n.derivacion)?.derivacion ?? null;
  const cuerpo = {
    nombre: sitio.nombre ?? null,
    config: sitio.config ?? {},
    diccionario: sitio.diccionario ?? {},
    nodos,
    ambito: sitio.ambito ?? {},
    derivacion,
  };
  const version = createHash('sha256').update(JSON.stringify(cuerpo)).digest('hex').slice(0, 12);
  return { indice: { version, ...cuerpo }, errores };
}
