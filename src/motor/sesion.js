// Sesión del chat en localStorage. Guarda eventos {t, tipo, ref}:
//   usuario   ref: texto que escribió o chip que pulsó (solo queda en este navegador)
//   nodo      ref: id del nodo mostrado
//   opciones  ref: [id, id] de "¿Te refieres a A o B?"
//   mixta     ref: { nodo: id, texto } de "Ver cómo lo trabajan" o "Escribir al equipo"
//   contacto  ref: { texto, derivado } mensaje precargado y si vino de una derivación
// No usa el DOM: recibe el almacenamiento, para poder probarse en node.
import { CLAVE_SESION, MAX_EVENTOS } from './config.js';

export const TIPOS = ['usuario', 'nodo', 'opciones', 'mixta', 'contacto'];

/** Crea la sesión sobre un almacenamiento con getItem/setItem/removeItem (localStorage o un doble de prueba). */
export function crearSesion(almacen, { clave = CLAVE_SESION, max = MAX_EVENTOS, reloj = () => Date.now() } = {}) {
  function cargar() {
    try {
      const datos = JSON.parse(almacen?.getItem(clave) ?? 'null');
      return Array.isArray(datos?.eventos) ? datos.eventos.filter(valido) : [];
    } catch {
      return [];
    }
  }

  function guardar(eventos) {
    try {
      almacen?.setItem(clave, JSON.stringify({ eventos: eventos.slice(-max) }));
    } catch {
      // Almacenamiento lleno o bloqueado (modo privado): la conversación sigue, sin guardarse.
    }
  }

  return {
    cargar,
    agregar(tipo, ref) {
      const evento = { t: reloj(), tipo, ref };
      if (!valido(evento)) return;
      guardar([...cargar(), evento]);
    },
    borrar() {
      try {
        almacen?.removeItem(clave);
      } catch {
        // Sin acceso al almacenamiento no hay nada que borrar.
      }
    },
  };
}

function valido(e) {
  return e && typeof e === 'object' && Number.isFinite(e.t) && TIPOS.includes(e.tipo) && e.ref !== undefined && e.ref !== null;
}

/**
 * Quita de los eventos los ids de nodos que ya no existen (el contenido cambió desde la última visita).
 * Un evento "opciones" que pierde un id queda con el otro; si pierde ambos, se descarta.
 */
export function filtrarEventos(eventos, existe) {
  const salida = [];
  for (const e of eventos) {
    if (e.tipo === 'nodo' && !existe(e.ref)) continue;
    if (e.tipo === 'opciones') {
      const ids = Array.isArray(e.ref) ? e.ref.filter(existe) : [];
      if (ids.length === 0) continue;
      salida.push({ ...e, ref: ids });
      continue;
    }
    if (e.tipo === 'mixta' && !existe(e.ref?.nodo)) continue;
    salida.push(e);
  }
  return salida;
}

/** Ids de los nodos que se mostraron, en orden y sin repetir: la ruta[] del contacto. */
export function rutaVisitada(eventos) {
  const ids = [];
  for (const e of eventos) {
    if (e.tipo === 'nodo' && typeof e.ref === 'string' && !ids.includes(e.ref)) ids.push(e.ref);
  }
  return ids.slice(-20);
}
