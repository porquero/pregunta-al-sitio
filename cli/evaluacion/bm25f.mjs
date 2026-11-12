// Variante experimental del motor: BM25F más propagación por las aristas del grafo (atenuación por
// salto, máximo 2 saltos) y contexto de conversación. No la usa el resolvedor; queda para medir si las
// aristas mejoran el ranking de un sitio.
import { crearBM25F, OPCIONES_D, CAMPOS } from '../../src/motor/resolver.js';
import { terminos as terminosBase } from '../../src/motor/normalizar.js';

export { crearBM25F, OPCIONES_D, CAMPOS };

export const OPCIONES_GRAFO = { atenuacion: 0.2, contexto: 0.6 };

/**
 * BM25F más grafo. La propagación parte de los puntajes de BM25F; la cobertura de un nodo es la suya o,
 * si solo llegó por propagación, la de su origen atenuada.
 */
export function crearGrafo(nodos, opcionesMotor = {}, opcionesGrafo = {}, terminos = terminosBase) {
  const o = { ...OPCIONES_GRAFO, ...opcionesGrafo };
  const d = crearBM25F(nodos, opcionesMotor, terminos);
  const aristas = new Map(nodos.map((n) => [n.id, (n.aristas ?? []).map((a) => [a.a, Number(a.peso ?? 0.5)])]));

  function buscar(consulta, { contexto = null } = {}) {
    const base = d.buscar(consulta);
    const puntaje = new Map(base.map((r) => [r.id, r.puntaje]));
    const cobertura = new Map(base.map((r) => [r.id, r.cobertura]));

    if (o.atenuacion > 0) {
      const extra = new Map();
      for (const r of base) {
        for (const [v, p1] of aristas.get(r.id) ?? []) {
          extra.set(v, (extra.get(v) ?? 0) + o.atenuacion * p1 * r.puntaje);
          if (!cobertura.has(v)) cobertura.set(v, r.cobertura * o.atenuacion);
          for (const [w, p2] of aristas.get(v) ?? []) {
            if (w === r.id) continue;
            extra.set(w, (extra.get(w) ?? 0) + o.atenuacion ** 2 * p1 * p2 * r.puntaje);
            if (!cobertura.has(w)) cobertura.set(w, r.cobertura * o.atenuacion ** 2);
          }
        }
      }
      for (const [v, e] of extra) puntaje.set(v, (puntaje.get(v) ?? 0) + e);
    }

    if (contexto && o.contexto > 0) {
      const vecinos = new Map(aristas.get(contexto) ?? []);
      for (const [v, s] of puntaje) {
        if (v === contexto) puntaje.set(v, s * (1 + o.contexto));
        else if (vecinos.has(v)) puntaje.set(v, s * (1 + o.contexto * vecinos.get(v)));
      }
    }

    return [...puntaje]
      .map(([id, p]) => ({ id, puntaje: p, cobertura: cobertura.get(id) ?? 0 }))
      .sort((x, y) => y.puntaje - x.puntaje);
  }

  return { buscar, serializable: d.serializable, opciones: { ...d.opciones, ...o } };
}
