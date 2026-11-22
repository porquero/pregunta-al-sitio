// Métricas de consultas: lo que el visitante ESCRIBE en el cuadro de texto, con la página y una frase de lo
// que respondió el chat. Los clics en chips, sugerencias y opciones no cuentan como consulta escrita.
// Se envía a la URL de la opción `metricas` y, siempre, se dispara el evento DOM `pas:consulta`.
// Sin DOM propio, para poder probarlo en Node. La limpieza de datos personales la hace el servidor.

/** Caracteres máximos del texto escrito que se envía. */
export const LARGO_TEXTO = 300;
/** Caracteres máximos de la frase de la respuesta. */
export const LARGO_RESPUESTA = 150;

/** { texto, url } de una consulta escrita: el texto tal cual (recortado) y la página sin query ni hash. */
export function datosConsulta(texto, ubicacion) {
  return { texto: String(texto ?? '').slice(0, LARGO_TEXTO), url: `${ubicacion.origin}${ubicacion.pathname}` };
}

const recortar = (t) => (t.length > LARGO_RESPUESTA ? `${t.slice(0, LARGO_RESPUESTA - 1)}…` : t);

/**
 * Frase corta de lo que respondió el chat, para saber qué preguntas quedaron sin respuesta:
 *   nodo      su título
 *   opciones  "Opciones: A | B"
 *   mixta     "Conocimiento general: A" (el chat ofrece el nodo A y escribir al equipo)
 *   contacto  "Derivada a contacto" (tema que el sitio deriva a propósito) o "Sin respuesta"
 * `evento` es el de decidir() (dialogo.js), `resultado` el del resolvedor y `porId` un Map id → nodo.
 */
export function fraseRespuesta(evento, resultado, porId = new Map()) {
  const titulo = (id) => String(porId.get(id)?.titulo ?? id);
  switch (evento?.tipo) {
    case 'nodo':
      return recortar(titulo(evento.ref));
    case 'opciones':
      return recortar(`Opciones: ${evento.ref.map(titulo).join(' | ')}`);
    case 'mixta':
      return recortar(`Conocimiento general: ${titulo(evento.ref.nodo)}`);
    default:
      return resultado?.ambito === 'derivar' ? 'Derivada a contacto' : 'Sin respuesta';
  }
}

/**
 * POST de `datos` en JSON a `url`, sin esperar respuesta: navigator.sendBeacon con un Blob application/json
 * y, si no existe o no acepta el envío, fetch con keepalive y sin credenciales. Nunca lanza ni bloquea: un
 * error de red o del servidor se ignora.
 */
export function enviarMetricas(url, datos, { navegador = globalThis.navigator, fetch: pedir = globalThis.fetch } = {}) {
  let cuerpo;
  try {
    cuerpo = JSON.stringify(datos);
  } catch {
    return;
  }
  try {
    if (typeof navegador?.sendBeacon === 'function' && navegador.sendBeacon(url, new Blob([cuerpo], { type: 'application/json' }))) return;
  } catch {
    // Algunos navegadores rechazan un Blob application/json en sendBeacon: se prueba con fetch.
  }
  try {
    const p = pedir?.(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true, credentials: 'omit' });
    p?.catch?.(() => {});
  } catch {
    // Sin fetch o con un error inmediato: se ignora.
  }
}
