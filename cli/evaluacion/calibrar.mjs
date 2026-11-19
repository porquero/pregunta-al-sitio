// Calibración del resolvedor para un sitio (pregunta-al-sitio calibrar).
// 1. Parámetros del motor: grilla sobre la partición de ajuste, por ranking (top-3 + MRR).
// 2. Umbrales de zona: grilla sobre ajuste; primero los que dejan el falso rechazo de validación dentro
//    del objetivo, luego los que cumplen OBJETIVO_CALIBRACION en ajuste (precisión alta 99 %) y por
//    último el mayor acierto total. Usar la validación en esta regla la vuelve menos independiente, a
//    cambio de no elegir umbrales que rechacen de más consultas que el chat sí sabe responder.
// 3. Compromiso: para cada umbral Cm (cobertura mínima de la zona media) se informa el mejor candidato,
//    con su falso rechazo y su fuga, para elegir a la vista.
// Repetir después de cambiar nodos, diccionario o reglas de ámbito.
import { crearBM25F, crearResolver, zonaDe } from '../../src/motor/resolver.js';
import { crearTerminos } from '../../src/motor/normalizar.js';
import { particion, esperaContacto, medibles } from './datos.mjs';
import { metricas, OBJETIVO_CALIBRACION } from './metricas.mjs';

export const GRILLA_MOTOR = [];
for (const k1 of [0.9, 1.2, 1.6])
  for (const kw of [2, 3])
    for (const pr of [1, 1.5])
      for (const frase of [0, 0.5, 1])
        for (const similitudMin of [0.4, 0.5])
          GRILLA_MOTOR.push({ k1, pesos: { titulo: 2, preguntas: pr, keywords: kw, sinonimos: 2 }, similitudMin, frase });

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

  function ranking(motor) {
    const conNodo = ajuste.filter((c) => !esperaContacto(c));
    let suma = 0;
    for (const c of conNodo) {
      const i = motor.buscar(c.consulta).slice(0, 10).findIndex((r) => c.esperado.includes(r.id));
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

  const resolvedor = crearResolver(datos, { motor });
  const corrida = (conjunto) =>
    conjunto.map((c) => ({ c, r: resolvedor.resolver(c.consulta), lista: resolvedor.buscar(c.consulta).map((x) => x.id) }));
  const aFilas = (corridas, u) =>
    corridas.map(({ c, r, lista }) => {
      const zona = zonaDe(r.ambito, r.senales, u);
      return { c, d: zona === 'baja' ? { zona: 'contacto', lista: ['contacto'] } : { zona, lista } };
    });

  const corridasAjuste = corrida(ajuste);
  const corridasValidacion = corrida(validacion);
  let mejor = null;
  const porCm = new Map();
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
            const candidato = { u, clave, ajuste: m, validacion: mv };
            if (!mejor || compararClaves(clave, mejor.clave) > 0) mejor = candidato;
            if (!porCm.has(Cm) || compararClaves(clave, porCm.get(Cm).clave) > 0) porCm.set(Cm, candidato);
          }
  const zonas = mejor.u;

  return {
    config: { ...datos.config, motor, zonas },
    escala: resolvedor.escala,
    ajuste: { n: ajuste.length, metricas: metricas(aFilas(corridasAjuste, zonas)) },
    validacion: { n: validacion.length, metricas: metricas(aFilas(corridasValidacion, zonas)) },
    compromiso: GRILLA_CM.filter((Cm) => porCm.has(Cm)).map((Cm) => {
      const c = porCm.get(Cm);
      const resumir = (m) => ({ falsoRechazo: m.falsoRechazo, fuga: m.fuga, precisionAlta: m.precisionAlta, aciertoTotal: m.aciertoTotal });
      return { Cm, zonas: c.u, ajuste: resumir(c.ajuste), validacion: resumir(c.validacion), elegido: c === mejor };
    }),
    objetivo,
  };
}
