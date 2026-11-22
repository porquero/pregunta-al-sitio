// Máquina de estados del chat. Decide qué mostrar según la zona del resolvedor:
//   alta     el nodo con más puntaje
//   media    "¿Te refieres a A o B?" con chips
//   mixta    conocimiento general con necesidad propia: "Ver cómo lo trabajan" y "Escribir al equipo"
//   baja     nodo contacto con el texto de derivación y la consulta precargada
// No toca el DOM: recibe un objeto render con un método por tipo de evento, para poder probarse en node.

/** Evento de respuesta para un resultado del resolvedor. */
export function decidir(resultado, texto) {
  const [primero] = resultado.nodos;
  switch (resultado.zona) {
    case 'alta':
      return { tipo: 'nodo', ref: primero };
    case 'media':
      return resultado.nodos.length > 1 ? { tipo: 'opciones', ref: resultado.nodos } : { tipo: 'nodo', ref: primero };
    case 'mixta':
      return { tipo: 'mixta', ref: { nodo: primero, texto } };
    default:
      return { tipo: 'contacto', ref: { texto, derivado: true } };
  }
}

/** Las consultas sin respuesta se registran como tokens; los temas que se derivan a propósito, no. */
export function debeRegistrarse(resultado) {
  return resultado.zona === 'baja' && resultado.ambito !== 'derivar' && resultado.terminos.length > 0;
}

export const LARGO_MAXIMO = 200;

const tituloCorto = (n) => String(n.titulo ?? n.id).split(',')[0].trim();

/**
 * Chips de seguimiento de un nodo según la conversación. Quita los que llevan a un nodo ya mostrado en la
 * sesión (y al propio nodo). Si el nodo no declara chips, completa con los destinos de sus aristas, de mayor
 * a menor peso, hasta tener tantos como antes. El nodo de origen (el mostrado justo antes) solo vuelve
 * si no queda ninguna alternativa. Los chips que consultan un texto (sin nodo) se conservan.
 *   nodo    nodo del índice ({ id, seguimiento, chips, aristas })
 *   vistos  ids de los nodos mostrados antes, en orden
 *   porId   Map id → nodo del índice
 *   prioridad  id → peso del tipo del nodo (config.tipos): desempata aristas de igual peso, la oferta
 *              antes que el contenido
 */
export function chipsSeguimiento(nodo, { vistos = [], porId = new Map(), prioridad = () => 1 } = {}) {
  const base = nodo.seguimiento ?? [];
  const excluir = new Set([...vistos, nodo.id]);
  const salida = base.filter((s) => !s.nodo || !excluir.has(s.nodo));
  if (!(nodo.chips ?? []).length) {
    for (const a of [...(nodo.aristas ?? [])].sort((x, y) => y.peso - x.peso || prioridad(y.a) - prioridad(x.a))) {
      if (salida.length >= base.length) break;
      const destino = porId.get(a.a);
      if (!destino || excluir.has(destino.id) || salida.some((s) => s.nodo === destino.id)) continue;
      salida.push({ texto: tituloCorto(destino), nodo: destino.id });
    }
  }
  if (salida.length) return salida;
  const origen = vistos.at(-1);
  return base.filter((s) => s.nodo === origen);
}

/**
 * Temas para seguir cuando la consulta no tuvo respuesta: los chips de la bienvenida (nodo de tipo saludo),
 * sin los nodos ya mostrados ni contacto. Así el visitante ve que puede seguir preguntando.
 *   nodos   nodos del índice
 *   vistos  ids de los nodos mostrados antes
 */
export function sugerenciasSinRespuesta(nodos, { vistos = [], prioridad } = {}) {
  const saludo = nodos.find((n) => n.tipo === 'saludo');
  if (!saludo) return [];
  const porId = new Map(nodos.map((n) => [n.id, n]));
  return chipsSeguimiento(saludo, { vistos: [...vistos, 'contacto'], porId, prioridad }).filter((s) => s.nodo !== 'contacto');
}

/**
 * Controlador del diálogo. Las interacciones se encolan: una respuesta termina de mostrarse antes
 * de procesar la siguiente, aunque el usuario pulse varios chips seguidos.
 *   obtenerResolver  () => Promise<{ resolver }>
 *   render           { usuario, nodo, opciones, mixta, contacto } (cada uno recibe ref y { animar })
 *   sesion           { agregar(tipo, ref) }
 *   registrarSinRespuesta (terminos) => void
 */
export function crearDialogo({ obtenerResolver, render, sesion, registrarSinRespuesta = () => {} }) {
  let cola = Promise.resolve();
  const encolar = (tarea) => {
    cola = cola.then(tarea).catch((error) => console.error('Chat:', error));
    return cola;
  };

  // Nodos mostrados en la conversación, en orden: el render los usa para no repetir chips.
  const vistos = [];
  const mostrar = (evento, opciones) => {
    if (evento.tipo === 'contacto') return render.contacto(evento.ref, { ...opciones, vistos: [...vistos] });
    if (evento.tipo !== 'nodo') return render[evento.tipo](evento.ref, opciones);
    const previos = [...vistos];
    if (vistos.at(-1) !== evento.ref) vistos.push(evento.ref);
    return render.nodo(evento.ref, { ...opciones, vistos: previos });
  };
  const registrar = (evento) => {
    sesion.agregar(evento.tipo, evento.ref);
    return mostrar(evento, { animar: true });
  };

  return {
    /**
     * Consulta un texto. `alResponder(evento, resultado)`, si se da, recibe lo que el chat decidió mostrar
     * antes de mostrarlo (el widget lo usa para las métricas de las consultas escritas); un error ahí no
     * interrumpe la respuesta.
     */
    preguntar(texto, { alResponder = null } = {}) {
      const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO);
      if (!limpio) return cola;
      return encolar(async () => {
        await registrar({ tipo: 'usuario', ref: limpio });
        const { resolver } = await obtenerResolver();
        const resultado = resolver(limpio);
        if (debeRegistrarse(resultado)) registrarSinRespuesta(resultado.terminos);
        const evento = decidir(resultado, limpio);
        try {
          alResponder?.(evento, resultado);
        } catch (error) {
          console.error('Chat:', error);
        }
        await registrar(evento);
      });
    },

    abrirNodo(id, etiqueta) {
      return encolar(async () => {
        await registrar({ tipo: 'usuario', ref: etiqueta });
        await registrar({ tipo: 'nodo', ref: id });
      });
    },

    escribirAlEquipo(texto, etiqueta = 'Escribir al equipo') {
      return encolar(async () => {
        await registrar({ tipo: 'usuario', ref: etiqueta });
        await registrar({ tipo: 'contacto', ref: { texto, derivado: false } });
      });
    },

    /** Restaura una conversación guardada, sin animación ni retardo. */
    restaurar(eventos) {
      return encolar(async () => {
        for (const evento of eventos) await mostrar(evento, { animar: false });
      });
    },
  };
}
