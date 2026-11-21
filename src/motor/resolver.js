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
//   config       { motor, zonas, opcionesMedia, tipos, empate, normaPorTerminos } que reemplazan los
//                valores de config.js. Sin tipos ni normaPorTerminos el motor se comporta como antes.
//
// Prioridad por tipo (config.tipos): el puntaje de cada nodo se multiplica por el peso de su tipo antes
// de calcular zona, margen y orden; ante un empate cercano (config.empate) va primero el tipo de mayor
// peso. Los tipos con respaldo: true solo compiten en una segunda vuelta, si la primera (sin ellos) cae
// en zona baja.
//
// Zonas:
//   alta   responde con nodos[0].
//   media  "¿Te refieres a A o B?" con nodos[0..1].
//   mixta  conocimiento general con necesidad propia: chips "Ver cómo lo trabajan" (nodos[0])
//          y "Escribir al equipo".
//   baja   fuera de ámbito, tema derivado o puntaje insuficiente: nodo contacto con el texto `derivacion`.
import { crearTerminos, terminos as terminosBase, trigramas } from './normalizar.js';
import { prepararAmbito, clasificarAmbito } from './ambito.js';
import { MOTOR, ZONAS, OPCIONES_MEDIA, EMPATE } from './config.js';

export const CAMPOS = ['titulo', 'preguntas', 'keywords', 'sinonimos'];

export const OPCIONES_D = {
  k1: 1.2,
  pesos: { titulo: 2, preguntas: 1, keywords: 3, sinonimos: 2 },
  b: { titulo: 0.5, preguntas: 0.75, keywords: 0.3, sinonimos: 0.3 },
  similitudMin: 0.45, // Dice de trigramas para aceptar una corrección
  frase: 0.5, // bonificación por par de términos consecutivos presente en un campo, en idf promedio
};

/** Errores de tipeo que se corrigen por distancia de edición según el largo del término. */
export const erratasPermitidas = (largo) => (largo >= 9 ? 2 : largo >= 5 ? 1 : 0);

/**
 * Distancia de Levenshtein entre a y b, o max + 1 en cuanto se sabe que supera max.
 * Sustituir, insertar o borrar una letra cuesta 1.
 */
export function distanciaEdicion(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (fila[j] < minimo) minimo = fila[j];
    }
    if (minimo > max) return max + 1;
    previa = fila;
  }
  return previa[b.length];
}

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

  // Vocabulario por largo, para el cotejo por distancia de edición.
  const porLargo = new Map();
  for (const t of df.keys()) {
    if (!porLargo.has(t.length)) porLargo.set(t.length, []);
    porLargo.get(t.length).push(t);
  }

  // Índice de trigramas del vocabulario para corregir errores de tipeo.
  const porTrigrama = new Map();
  for (const t of df.keys()) {
    if (t.length < 4) continue;
    for (const g of new Set(trigramas(t))) {
      if (!porTrigrama.has(g)) porTrigrama.set(g, []);
      porTrigrama.get(g).push(t);
    }
  }

  /**
   * Término de la consulta → [[término del vocabulario, similitud]].
   * Orden: exacto; distancia de edición (1 en términos de 5 a 8 letras, 2 desde 9); trigramas.
   */
  function expandir(q) {
    if (df.has(q)) return [[q, 1]];
    const k = erratasPermitidas(q.length);
    if (k > 0) {
      let mejor = null;
      let distancia = k + 1;
      for (let largo = q.length - k; largo <= q.length + k; largo++) {
        for (const t of porLargo.get(largo) ?? []) {
          const d = distanciaEdicion(q, t, Math.min(distancia, k));
          if (d > k) continue;
          // Desempate: el término más frecuente en el sitio.
          if (d < distancia || (d === distancia && df.get(t) > df.get(mejor))) [mejor, distancia] = [t, d];
        }
      }
      if (mejor) return [[mejor, 1 - distancia / Math.max(q.length, mejor.length)]];
    }
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

  // Saturación de la frecuencia por campo: en los campos de tfLog, f pasa a 1 + ln(f). Un término repetido
  // en casi todas las preguntas de un nodo ya no suma como si fueran frases distintas.
  const saturados = new Set(o.tfLog ?? []);

  function tfPonderado(doc, t) {
    let suma = 0;
    for (const c of CAMPOS) {
      const campo = doc.campos[c];
      let f = campo.tf.get(t);
      if (!f) continue;
      if (saturados.has(c)) f = 1 + Math.log(f);
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

/** Mediana de términos de las preguntas de ejemplo: referencia para normalizar por largo de consulta. */
export function terminosReferencia(nodos, terminos = terminosBase) {
  const largos = [];
  for (const n of nodos) for (const p of n.preguntas ?? []) largos.push(new Set(terminos(p)).size);
  largos.sort((a, b) => a - b);
  return largos[Math.floor(largos.length / 2)] || 1;
}

/**
 * Señales de confianza del primer resultado. Los resultados vienen ordenados por puntaje.
 * opciones.terminos y opciones.referencia: con normalización por largo, una consulta de menos términos
 * que la referencia se compara con una escala proporcional (una palabra no puede sumar como cuatro).
 */
export function senales(resultados, escala, { terminos = 0, referencia = 0 } = {}) {
  const [r1, r2] = resultados;
  if (!r1) return { norm: 0, cobertura: 0, margen: 0 };
  const factor = referencia > 0 && terminos > 0 && terminos < referencia ? terminos / referencia : 1;
  return {
    norm: r1.puntaje / (escala * factor),
    cobertura: r1.cobertura,
    margen: r2 ? (r1.puntaje - r2.puntaje) / r1.puntaje : 1,
  };
}

/** Peso de un tipo según config.tipos (1 si no está). */
export const pesoTipo = (tipos, tipo) => Number(tipos?.[tipo]?.peso ?? 1);

/**
 * Puntajes ajustados por tipo: multiplica cada puntaje por el peso de su tipo y reordena. Conserva el
 * puntaje del motor en `base`. Sin tipos devuelve la misma lista.
 */
export function ajustarPorTipo(resultados, tipoDe, tipos) {
  if (!tipos || !Object.keys(tipos).length) return resultados;
  return resultados
    .map((r) => ({ ...r, base: r.puntaje, puntaje: r.puntaje * pesoTipo(tipos, tipoDe(r.id)) }))
    .sort((x, y) => y.puntaje - x.puntaje);
}

/**
 * Empate cercano: entre candidatos consecutivos que difieren en menos de `empate` (fracción del mayor),
 * va primero el de mayor prioridad. Inserción estable: con prioridades iguales el orden no cambia.
 */
export function desempatar(resultados, prioridad, empate) {
  if (!(empate > 0)) return resultados;
  const salida = [...resultados];
  for (let i = 1; i < salida.length; i++) {
    let j = i;
    while (j > 0) {
      const [a, b] = [salida[j - 1], salida[j]];
      const cerca = a.puntaje > 0 && (a.puntaje - b.puntaje) / a.puntaje < empate;
      if (!cerca || prioridad(b.id) <= prioridad(a.id)) break;
      [salida[j - 1], salida[j]] = [b, a];
      j -= 1;
    }
  }
  return salida;
}

/** Zona según el ámbito y las señales. Es la misma regla que usa la calibración. */
export function zonaDe(tipoAmbito, s, u) {
  if (tipoAmbito === 'general' || tipoAmbito === 'derivar') return 'baja';
  if (tipoAmbito === 'mixto') return 'mixta';
  if (s.norm >= u.Ta && s.cobertura >= u.Ca && s.margen >= u.Ma) return 'alta';
  if (s.norm >= u.Tm && s.cobertura >= u.Cm) return 'media';
  return 'baja';
}

/**
 * Zona con segunda vuelta. senalesPorVuelta[0] es la primera vuelta (sin nodos de respaldo) y, si hay,
 * [1] la segunda (todos los nodos). La segunda solo se usa si la primera cae en zona baja por puntaje.
 * Devuelve { zona, vuelta }. Es la misma regla que usa la calibración.
 */
export function zonaVueltas(tipoAmbito, senalesPorVuelta, u) {
  const zona = zonaDe(tipoAmbito, senalesPorVuelta[0], u);
  if (zona !== 'baja' || senalesPorVuelta.length < 2 || tipoAmbito === 'general' || tipoAmbito === 'derivar') {
    return { zona, vuelta: 0 };
  }
  const segunda = zonaDe(tipoAmbito, senalesPorVuelta[1], u);
  return segunda === 'baja' ? { zona, vuelta: 0 } : { zona: segunda, vuelta: 1 };
}

/** config.tipos normalizado: { tipo: { peso, respaldo } }. */
function tiposDe(tipos = {}) {
  const salida = {};
  for (const [tipo, v] of Object.entries(tipos ?? {})) {
    salida[tipo] = { peso: Number(v?.peso ?? 1), respaldo: v?.respaldo === true };
  }
  return salida;
}

/** Configuración efectiva: valores de config.js reemplazados por los del índice. */
export function configDe(datos = {}) {
  const c = datos.config ?? {};
  return {
    motor: { ...MOTOR, ...c.motor, pesos: { ...MOTOR.pesos, ...c.motor?.pesos } },
    zonas: { ...ZONAS, ...c.zonas },
    opcionesMedia: Number(c.opcionesMedia ?? OPCIONES_MEDIA),
    tipos: tiposDe(c.tipos),
    empate: Number(c.empate ?? EMPATE),
    normaPorTerminos: c.normaPorTerminos === true,
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
  const tipoDe = new Map(nodos.map((n) => [n.id, n.tipo]));
  const tipos = opciones.tipos ?? config.tipos;
  const respaldo = new Set(nodos.filter((n) => tipos[n.tipo]?.respaldo).map((n) => n.id));
  const prioridad = (id) => pesoTipo(tipos, tipoDe.get(id));
  const referencia = config.normaPorTerminos ? terminosReferencia(nodos, terminos) : 0;

  // El saludo no es una opción útil en "¿Te refieres a A o B?": solo queda si no hay otra.
  function opcionesMedia(ids) {
    const utiles = ids.filter((id) => !saludos.has(id));
    return (utiles.length ? utiles : ids).slice(0, config.opcionesMedia);
  }

  /** Resultados del motor ajustados por tipo y desempatados por prioridad. */
  function buscar(consulta) {
    return desempatar(ajustarPorTipo(motor.buscar(consulta), (id) => tipoDe.get(id), tipos), prioridad, config.empate);
  }

  /**
   * Vueltas de búsqueda: sin nodos de respaldo, una sola. Con ellos, la primera excluye el respaldo y la
   * segunda los incluye a todos. Cada vuelta: { resultados, senales }.
   */
  function vueltasDe(consulta, tipoAmbito) {
    if (tipoAmbito === 'general' || tipoAmbito === 'derivar') return [{ resultados: [], senales: senales([], escala) }];
    const todos = buscar(consulta);
    const largo = { terminos: new Set(terminos(consulta)).size, referencia };
    const todas = { resultados: todos, senales: senales(todos, escala, largo) };
    if (!respaldo.size) return [todas];
    const primeros = todos.filter((r) => !respaldo.has(r.id));
    return [{ resultados: primeros, senales: senales(primeros, escala, largo) }, todas];
  }

  /** Orden completo mostrado: en la primera vuelta, el respaldo va al final. */
  function ordenDe(vueltas, vuelta) {
    if (vuelta === 1 || vueltas.length === 1) return vueltas[vuelta].resultados;
    return [...vueltas[0].resultados, ...vueltas[1].resultados.filter((r) => respaldo.has(r.id))];
  }

  function resolver(consulta) {
    const { tipo } = clasificarAmbito(consulta, ambito);
    const vueltas = vueltasDe(consulta, tipo);
    const { zona, vuelta } = zonaVueltas(tipo, vueltas.map((v) => v.senales), zonas);
    const orden = ordenDe(vueltas, vuelta);
    const ids = vueltas[vuelta].resultados.map((r) => r.id);
    let nodosRespuesta;
    if (zona === 'alta' || zona === 'mixta') nodosRespuesta = ids.slice(0, 1);
    else if (zona === 'media') nodosRespuesta = opcionesMedia(ids);
    else nodosRespuesta = ['contacto'];
    return {
      zona,
      nodos: nodosRespuesta,
      ambito: tipo,
      senales: vueltas[vuelta].senales,
      vuelta,
      // Para calibrar: señales de cada vuelta y el orden de cada desenlace.
      vueltas: vueltas.map((v) => v.senales),
      ordenes: vueltas.map((_, i) => ordenDe(vueltas, i).map((r) => r.id)),
      // Solo tokens normalizados: es lo único que puede registrarse sin exponer el texto del visitante.
      terminos: terminos(consulta),
      derivacion: zona === 'baja' ? derivacion : null,
      candidatos: orden.slice(0, 3),
      orden: orden.map((r) => r.id),
    };
  }

  return {
    resolver,
    buscar,
    terminos,
    escala,
    respaldo,
    config: { ...config, tipos, motor: motor.opciones, zonas },
    version: datos.version,
  };
}
