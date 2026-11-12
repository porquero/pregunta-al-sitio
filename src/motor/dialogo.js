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

  const mostrar = (evento, opciones) => render[evento.tipo](evento.ref, opciones);
  const registrar = (evento) => {
    sesion.agregar(evento.tipo, evento.ref);
    return mostrar(evento, { animar: true });
  };

  return {
    preguntar(texto) {
      const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO);
      if (!limpio) return cola;
      return encolar(async () => {
        await registrar({ tipo: 'usuario', ref: limpio });
        const { resolver } = await obtenerResolver();
        const resultado = resolver(limpio);
        if (debeRegistrarse(resultado)) registrarSinRespuesta(resultado.terminos);
        await registrar(decidir(resultado, limpio));
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
