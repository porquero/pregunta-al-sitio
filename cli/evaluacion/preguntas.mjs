// Revisión del set de evaluación (preguntas.yaml) contra el índice: lo que lo vuelve poco confiable.
// Errores: ids que no existen, consultas repetidas, generales que no esperan contacto.
// Avisos: composición por debajo del mínimo y nodos sin ninguna consulta que los espere.

export const COMPOSICION_MIN = { total: 150, general: 30, frontera: 15, necesidad: 15, ajena: 10 };
/** Proporción mínima de consultas cortas (una o dos palabras: "servicios", "precio hosting"). */
export const CORTAS_MIN = 0.1;

/** Palabras de una consulta tal como la escribe el visitante (sin signos). */
export const palabrasDe = (texto) => String(texto).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
export const TIPOS = ['anexo', 'coloquial', 'tipeo', 'multiple', 'general', 'necesidad', 'ajena', 'fuera', 'seguimiento'];

export function revisarPreguntas(consultas, indice, minimo = COMPOSICION_MIN) {
  const errores = [];
  const avisos = [];
  const ids = new Set(indice.nodos.map((n) => n.id));
  ids.add('contacto');
  const vistas = new Set();
  const esperados = new Map();

  for (const c of consultas) {
    const q = `"${c.consulta}"`;
    if (!c.consulta || typeof c.consulta !== 'string') {
      errores.push(`consulta #${c.n + 1} sin texto`);
      continue;
    }
    const clave = c.consulta.trim().toLowerCase();
    if (vistas.has(clave)) errores.push(`${q}: repetida`);
    vistas.add(clave);
    if (!TIPOS.includes(c.tipo)) errores.push(`${q}: tipo '${c.tipo}' inválido (${TIPOS.join(', ')})`);
    for (const id of c.esperado) {
      if (!ids.has(id)) errores.push(`${q}: esperado '${id}' no es un nodo del chat`);
      esperados.set(id, (esperados.get(id) ?? 0) + 1);
    }
    if (c.contexto && !ids.has(c.contexto)) errores.push(`${q}: contexto '${c.contexto}' no es un nodo del chat`);
    if (c.tipo === 'general' && !(c.esperado.length === 1 && c.esperado[0] === 'contacto')) {
      errores.push(`${q}: las de tipo general esperan solo contacto`);
    }
  }

  const cuenta = (f) => consultas.filter(f).length;
  const composicion = [
    ['total', consultas.length, minimo.total],
    ['general', cuenta((c) => c.tipo === 'general'), minimo.general],
    ['general de frontera', cuenta((c) => c.tipo === 'general' && c.frontera), minimo.frontera],
    ['necesidad', cuenta((c) => c.tipo === 'necesidad'), minimo.necesidad],
    ['ajena', cuenta((c) => c.tipo === 'ajena'), minimo.ajena],
  ];
  for (const [nombre, n, min] of composicion) if (n < min) avisos.push(`set: ${n} consultas ${nombre} (mínimo ${min})`);
  const cortas = cuenta((c) => c.tipo !== 'general' && palabrasDe(c.consulta) <= 2);
  if (consultas.length && cortas / consultas.length < CORTAS_MIN) {
    avisos.push(`set: ${cortas} consultas de una o dos palabras (${Math.round((cortas / consultas.length) * 100)} %; mínimo ${CORTAS_MIN * 100} %: "servicios", "hosting", "precios")`);
  }

  for (const n of indice.nodos) if (!esperados.has(n.id)) avisos.push(`set: ninguna consulta espera el nodo '${n.id}'`);

  return { errores, avisos };
}
