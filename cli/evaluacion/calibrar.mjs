// Calibración del resolvedor para un sitio (pregunta-al-sitio calibrar).
// 1. Parámetros del motor: grilla sobre la partición de ajuste, por ranking (top-3 + MRR).
// 2. Umbrales de zona: grilla sobre ajuste; primero los que dejan el falso rechazo de validación dentro
//    del objetivo, luego los que cumplen OBJETIVO_CALIBRACION en ajuste (precisión alta 99 %) y por
//    último el mayor acierto total. Usar la validación en esta regla la vuelve menos independiente, a
//    cambio de no elegir umbrales que rechacen de más consultas que el chat sí sabe responder.
// 3. Compromiso: para cada umbral Cm (cobertura mínima de la zona media) se informa el mejor candidato,
//    con su falso rechazo y su fuga, para elegir a la vista.
// 4. Comprobación sintética: el título corto y la primera keyword de cada nodo como consulta; informa
//    cuántas terminan en contacto con los umbrales elegidos (temas sueltos que el chat no reconoce).
// La grilla prueba también la saturación de frecuencia en preguntas (motor.tfLog) y la normalización por
// largo de consulta (normaPorTerminos). Ante empate gana la opción sin ellas, que es la de antes.
// Repetir después de cambiar nodos, diccionario o reglas de ámbito.
import { crearBM25F, crearResolver, zonaVueltas, ajustarPorTipo, configDe } from '../../src/motor/resolver.js';
import { crearTerminos } from '../../src/motor/normalizar.js';
import { particion, esperaContacto, medibles } from './datos.mjs';
import { metricas, OBJETIVO_CALIBRACION, avisosValidacion } from './metricas.mjs';

export const GRILLA_MOTOR = [];
for (const k1 of [0.9, 1.2, 1.6])
  for (const kw of [2, 3])
    for (const pr of [1, 1.5])
      for (const frase of [0, 0.5, 1])
        for (const similitudMin of [0.4, 0.5])
          for (const tfLog of [[], ['preguntas']])
            GRILLA_MOTOR.push({ k1, pesos: { titulo: 2, preguntas: pr, keywords: kw, sinonimos: 2 }, similitudMin, frase, tfLog });

/**
 * Temas sueltos: el título corto y la primera keyword de cada nodo (menos saludo y contacto) como
 * consulta. Devuelve { total, aContacto: [{ nodo, consulta }] } con la configuración dada.
 */
export function comprobacionSintetica(datos) {
  const r = crearResolver(datos);
  const consultas = [];
  for (const n of datos.nodos) {
    if (n.tipo === 'saludo' || n.id === 'contacto') continue;
    const titulo = String(n.titulo ?? '').split(',')[0].trim();
    for (const q of new Set([titulo, n.keywords?.[0]].filter(Boolean))) consultas.push({ nodo: n.id, consulta: q });
  }
  const aContacto = consultas.filter((c) => r.resolver(c.consulta).zona === 'baja');
  return { total: consultas.length, aContacto };
}

/** Orden lexicográfico: gana la primera componente que difiere. */
function compararClaves(a, b) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return a[i] - b[i];
  return 0;
}

export const GRILLA_CM = [0.2, 0.3, 0.4, 0.5];

/**
 * Calibra motor y zonas. Devuelve { config, ajuste, validacion, escala, compromiso, objetivo }.
 * maxFalsoRechazo reemplaza el objetivo de falso rechazo (por defecto el de OBJETIVO, 5 %).
 */
export function calibrar(datos, consultas, { objetivo: base = OBJETIVO_CALIBRACION, maxFalsoRechazo = null } = {}) {
  const objetivo = maxFalsoRechazo === null ? base : { ...base, falsoRechazo: maxFalsoRechazo };
  const { ajuste, validacion } = particion(medibles(consultas));
  const terminos = crearTerminos(datos.diccionario ?? {});
  const { tipos } = configDe(datos);
  const tipoDe = new Map(datos.nodos.map((n) => [n.id, n.tipo]));

  function ranking(motor) {
    const conNodo = ajuste.filter((c) => !esperaContacto(c));
    let suma = 0;
    for (const c of conNodo) {
      const lista = ajustarPorTipo(motor.buscar(c.consulta), (id) => tipoDe.get(id), tipos);
      const i = lista.slice(0, 10).findIndex((r) => c.esperado.includes(r.id));
      if (i >= 0 && i < 3) suma += 1;
      if (i >= 0) suma += 1 / (i + 1);
    }
    return suma / conNodo.length;
  }

  let elegido = null;
  for (const op of GRILLA_MOTOR) {
    const p = ranking(crearBM25F(datos.nodos, op, terminos));
    if (!elegido || p > elegido.p + 1e-9) elegido = { op, p };
  }
  const motor = elegido.op;

  const conNorma = (normaPorTerminos) => ({ ...datos, config: { ...datos.config, normaPorTerminos } });
  const aFilas = (corridas, u) =>
    corridas.map(({ c, r }) => {
      const { zona, vuelta } = zonaVueltas(r.ambito, r.vueltas, u);
      return { c, d: zona === 'baja' ? { zona: 'contacto', lista: ['contacto'] } : { zona, lista: r.ordenes[vuelta] } };
    });

  let mejor = null;
  const porCm = new Map();
  const corridas = {};
  for (const norma of [false, true]) {
    const resolvedor = crearResolver(conNorma(norma), { motor });
    const corrida = (conjunto) => conjunto.map((c) => ({ c, r: resolvedor.resolver(c.consulta) }));
    const corridasAjuste = corrida(ajuste);
    const corridasValidacion = corrida(validacion);
    corridas[norma] = { resolvedor, corridasAjuste, corridasValidacion };
    for (const Ta of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1])
      for (const Ca of [0.5, 0.6, 0.7, 0.8, 0.9])
        for (const Ma of [0, 0.05, 0.1, 0.2, 0.3])
          for (const Tm of [0.05, 0.1, 0.15, 0.2, 0.3])
            for (const Cm of GRILLA_CM) {
              if (Tm > Ta || Cm > Ca) continue;
              const u = { Ta, Ca, Ma, Tm, Cm };
              const m = metricas(aFilas(corridasAjuste, u));
              const mv = metricas(aFilas(corridasValidacion, u));
              const deficit =
                Math.max(0, objetivo.precisionAlta - m.precisionAlta) + Math.max(0, m.fuga - objetivo.fuga) + Math.max(0, m.falsoRechazo - objetivo.falsoRechazo);
              const clave = [-Math.max(0, mv.falsoRechazo - objetivo.falsoRechazo), -deficit, m.aciertoTotal, m.top1, m.altas];
              const candidato = { u, norma, clave, ajuste: m, validacion: mv };
              if (!mejor || compararClaves(clave, mejor.clave) > 0) mejor = candidato;
              if (!porCm.has(Cm) || compararClaves(clave, porCm.get(Cm).clave) > 0) porCm.set(Cm, candidato);
            }
  }
  const zonas = mejor.u;
  const normaPorTerminos = mejor.norma;
  const { resolvedor, corridasAjuste, corridasValidacion } = corridas[normaPorTerminos];
  const config = { ...datos.config, motor, zonas, normaPorTerminos };
  const metricasAjuste = metricas(aFilas(corridasAjuste, zonas));
  const metricasValidacion = metricas(aFilas(corridasValidacion, zonas));

  return {
    config,
    escala: resolvedor.escala,
    ajuste: { n: ajuste.length, metricas: metricasAjuste },
    validacion: { n: validacion.length, metricas: metricasValidacion },
    avisos: avisosValidacion(metricasAjuste, metricasValidacion),
    sintetica: comprobacionSintetica({ ...datos, config }),
    compromiso: GRILLA_CM.filter((Cm) => porCm.has(Cm)).map((Cm) => {
      const c = porCm.get(Cm);
      const resumir = (m) => ({ falsoRechazo: m.falsoRechazo, fuga: m.fuga, precisionAlta: m.precisionAlta, aciertoTotal: m.aciertoTotal });
      return { Cm, zonas: c.u, ajuste: resumir(c.ajuste), validacion: resumir(c.validacion), elegido: c === mejor };
    }),
    objetivo,
  };
}
