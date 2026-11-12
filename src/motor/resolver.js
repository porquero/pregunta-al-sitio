// Resolvedor: BM25F propio sobre los campos del nodo, con tolerancia a errores por trigramas y
// bonificación por frases, más el detector de ámbito y las tres zonas de confianza.
// Es la única implementación: la evaluación y la calibración también usan este archivo.
//
// Uso:
//   const r = crearResolver(await (await fetch('/indice.json')).json());
//   r.resolver('¿Tienen hosting?') → { zona, nodos, ambito, senales, terminos, derivacion, candidatos }
//
// El índice trae, además de los nodos:
//   diccionario  sinónimos del sitio, que se suman al diccionario base de normalizar.js
//   ambito       reglas del detector de ámbito (ambito.js)
//   derivacion   texto para la zona baja
//   config       { motor, zonas, opcionesMedia } que reemplazan los valores de config.js
//
// Zonas:
//   alta   responde con nodos[0].
//   media  "¿Te refieres a A o B?" con nodos[0..1].
//   mixta  conocimiento general con necesidad propia: chips "Ver cómo lo trabajan" (nodos[0])
//          y "Escribir al equipo".
//   baja   fuera de ámbito, tema derivado o puntaje insuficiente: nodo contacto con el texto `derivacion`.
import { crearTerminos, terminos as terminosBase, trigramas } from './normalizar.js';
import { prepararAmbito, clasificarAmbito } from './ambito.js';
import { MOTOR, ZONAS, OPCIONES_MEDIA } from './config.js';

export const CAMPOS = ['titulo', 'preguntas', 'keywords', 'sinonimos'];

export const OPCIONES_D = {
  k1: 1.2,
  pesos: { titulo: 2, preguntas: 1, keywords: 3, sinonimos: 2 },
  b: { titulo: 0.5, preguntas: 0.75, keywords: 0.3, sinonimos: 0.3 },
  similitudMin: 0.45, // Dice de trigramas para aceptar una corrección
  frase: 0.5, // bonificación por par de términos consecutivos presente en un campo, en idf promedio
};

const textosDe = (n, campo) => (campo === 'titulo' ? [n.titulo] : n[campo] ?? []);

/**
 * Índice BM25F. buscar(consulta) → [{ id, puntaje, cobertura }] de mayor a menor.
 * `terminos` es la función de términos del sitio (crearTerminos con su diccionario).
 */
export function crearBM25F(nodos, opciones = {}, terminos = terminosBase) {
  const o = {
    ...OPCIONES_D,
    ...opciones,
    pesos: { ...OPCIONES_D.pesos, ...opciones.pesos },
    b: { ...OPCIONES_D.b, ...opciones.b },
  };

  const df = new Map();
  const largoTotal = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
  const docs = nodos.map((n) => {
    const campos = {};
    const vistos = new Set();
    for (const c of CAMPOS) {
      const tf = new Map();
      const bigramas = new Set();
      let largo = 0;
      for (const texto of textosDe(n, c)) {
        const seq = terminos(texto);
        seq.forEach((t, i) => {
          tf.set(t, (tf.get(t) ?? 0) + 1);
          vistos.add(t);
          if (i > 0) bigramas.add(`${seq[i - 1]} ${t}`);
        });
        largo += seq.length;
      }
      campos[c] = { tf, bigramas, largo };
      largoTotal[c] += largo;
    }
    for (const t of vistos) df.set(t, (df.get(t) ?? 0) + 1);
    return { id: n.id, campos };
  });

  const N = docs.length;
  const promedio = Object.fromEntries(CAMPOS.map((c) => [c, largoTotal[c] / N || 1]));
  const idf = new Map([...df].map(([t, d]) => [t, Math.log(1 + (N - d + 0.5) / (d + 0.5))]));
  const idfMax = Math.log(1 + (N - 0.5) / 1.5);

  // Índice de trigramas del vocabulario para corregir errores de tipeo.
  const porTrigrama = new Map();
  for (const t of df.keys()) {
    if (t.length < 4) continue;
    for (const g of new Set(trigramas(t))) {
      if (!porTrigrama.has(g)) porTrigrama.set(g, []);
      porTrigrama.get(g).push(t);
    }
  }

  /** Término de la consulta → [[término del vocabulario, similitud]]. */
  function expandir(q) {
    if (df.has(q)) return [[q, 1]];
    if (q.length < 4) return [];
    const propios = new Set(trigramas(q));
    const comunes = new Map();
    for (const g of propios) for (const t of porTrigrama.get(g) ?? []) comunes.set(t, (comunes.get(t) ?? 0) + 1);
    let mejor = null;
    let sim = 0;
    for (const [t, k] of comunes) {
      const s = (2 * k) / (propios.size + new Set(trigramas(t)).size);
      if (s > sim) [mejor, sim] = [t, s];
    }
    return mejor && sim >= o.similitudMin ? [[mejor, sim]] : [];
  }

  function tfPonderado(doc, t) {
    let suma = 0;
    for (const c of CAMPOS) {
      const campo = doc.campos[c];
      const f = campo.tf.get(t);
      if (!f) continue;
      suma += (o.pesos[c] * f) / (1 - o.b[c] + (o.b[c] * campo.largo) / promedio[c]);
    }
    return suma;
  }

  function buscar(consulta) {
    const qs = [...new Set(terminos(consulta))];
    const exp = qs.map(expandir);
    const pesoQ = qs.map((q, i) => (exp[i][0] ? idf.get(exp[i][0][0]) : idfMax));
    const pesoTotal = pesoQ.reduce((a, b) => a + b, 0) || 1;

    const resultados = [];
    for (const doc of docs) {
      let puntaje = 0;
      let cubierto = 0;
      const elegidos = [];
      qs.forEach((_, i) => {
        let mejor = 0;
        let termino = null;
        for (const [t, sim] of exp[i]) {
          const tfp = tfPonderado(doc, t);
          if (!tfp) continue;
          const aporte = sim * idf.get(t) * ((tfp * (o.k1 + 1)) / (tfp + o.k1));
          if (aporte > mejor) [mejor, termino] = [aporte, t];
        }
        if (mejor > 0) {
          puntaje += mejor;
          cubierto += pesoQ[i] * exp[i][0][1];
        }
        elegidos.push(termino);
      });
      if (puntaje <= 0) continue;
      if (o.frase > 0) {
        for (let i = 1; i < elegidos.length; i++) {
          const [a, b] = [elegidos[i - 1], elegidos[i]];
          if (!a || !b) continue;
          if (CAMPOS.some((c) => doc.campos[c].bigramas.has(`${a} ${b}`))) {
            puntaje += (o.frase * (idf.get(a) + idf.get(b))) / 2;
          }
        }
      }
      resultados.push({ id: doc.id, puntaje, cobertura: cubierto / pesoTotal });
    }
    return resultados.sort((x, y) => y.puntaje - x.puntaje);
  }

  const serializable = () => ({
    docs: docs.map((d) => ({
      id: d.id,
      campos: Object.fromEntries(CAMPOS.map((c) => [c, { tf: [...d.campos[c].tf], bigramas: [...d.campos[c].bigramas], largo: d.campos[c].largo }])),
    })),
    df: [...df],
  });

  return { buscar, serializable, opciones: o };
}

/** Mediana del mejor puntaje al buscar las preguntas de ejemplo de los nodos: escala del puntaje normalizado. */
export function escalaDe(motor, nodos) {
  const tops = [];
  for (const n of nodos) for (const p of n.preguntas ?? []) tops.push(motor.buscar(p)[0]?.puntaje ?? 0);
  tops.sort((a, b) => a - b);
  return tops[Math.floor(tops.length / 2)] || 1;
}

/** Señales de confianza del primer resultado. */
export function senales(resultados, escala) {
  const [r1, r2] = resultados;
  if (!r1) return { norm: 0, cobertura: 0, margen: 0 };
  return {
    norm: r1.puntaje / escala,
    cobertura: r1.cobertura,
    margen: r2 ? (r1.puntaje - r2.puntaje) / r1.puntaje : 1,
  };
}

/** Zona según el ámbito y las señales. Es la misma regla que usa la calibración. */
export function zonaDe(tipoAmbito, s, u) {
  if (tipoAmbito === 'general' || tipoAmbito === 'derivar') return 'baja';
  if (tipoAmbito === 'mixto') return 'mixta';
  if (s.norm >= u.Ta && s.cobertura >= u.Ca && s.margen >= u.Ma) return 'alta';
  if (s.norm >= u.Tm && s.cobertura >= u.Cm) return 'media';
  return 'baja';
}

/** Configuración efectiva: valores de config.js reemplazados por los del índice. */
export function configDe(datos = {}) {
  const c = datos.config ?? {};
  return {
    motor: { ...MOTOR, ...c.motor, pesos: { ...MOTOR.pesos, ...c.motor?.pesos } },
    zonas: { ...ZONAS, ...c.zonas },
    opcionesMedia: Number(c.opcionesMedia ?? OPCIONES_MEDIA),
  };
}

/**
 * Arma el resolvedor a partir del índice del sitio.
 * opciones: { motor, zonas } reemplazan la configuración del índice (los usa la calibración).
 */
export function crearResolver(datos, opciones = {}) {
  const nodos = datos.nodos ?? [];
  const config = configDe(datos);
  const terminos = crearTerminos(datos.diccionario ?? {});
  const motor = crearBM25F(nodos, opciones.motor ?? config.motor, terminos);
  const zonas = opciones.zonas ?? config.zonas;
  const ambito = prepararAmbito(datos.ambito ?? {}, nodos, terminos);
  const escala = escalaDe(motor, nodos);
  const derivacion = datos.derivacion ?? '';
  const saludos = new Set(nodos.filter((n) => n.tipo === 'saludo').map((n) => n.id));

  // El saludo no es una opción útil en "¿Te refieres a A o B?": solo queda si no hay otra.
  function opcionesMedia(ids) {
    const utiles = ids.filter((id) => !saludos.has(id));
    return (utiles.length ? utiles : ids).slice(0, config.opcionesMedia);
  }

  function resolver(consulta) {
    const { tipo } = clasificarAmbito(consulta, ambito);
    const resultados = tipo === 'general' || tipo === 'derivar' ? [] : motor.buscar(consulta);
    const s = senales(resultados, escala);
    const zona = zonaDe(tipo, s, zonas);
    const ids = resultados.map((r) => r.id);
    let nodosRespuesta;
    if (zona === 'alta' || zona === 'mixta') nodosRespuesta = ids.slice(0, 1);
    else if (zona === 'media') nodosRespuesta = opcionesMedia(ids);
    else nodosRespuesta = ['contacto'];
    return {
      zona,
      nodos: nodosRespuesta,
      ambito: tipo,
      senales: s,
      // Solo tokens normalizados: es lo único que puede registrarse sin exponer el texto del visitante.
      terminos: terminos(consulta),
      derivacion: zona === 'baja' ? derivacion : null,
      candidatos: resultados.slice(0, 3),
    };
  }

  return { resolver, buscar: motor.buscar, terminos, escala, config: { ...config, motor: motor.opciones, zonas }, version: datos.version };
}
