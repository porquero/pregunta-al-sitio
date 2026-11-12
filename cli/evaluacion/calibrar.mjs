// Calibración del resolvedor para un sitio.
//   node cli/evaluacion/calibrar.mjs [--indice indice.json] [--preguntas preguntas.yaml] [--escribir]
// Sin --indice usa el fixture de Playa. Con --escribir guarda el resultado en la clave "config" del índice.
//
// 1. Parámetros del motor: grilla sobre la partición de ajuste, por ranking (top-3 + MRR).
// 2. Umbrales de zona: grilla sobre ajuste; primero los que cumplen los objetivos de calidad,
//    luego el mayor acierto total. La validación solo se informa.
// Repetir después de cambiar nodos, diccionario o reglas de ámbito.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { crearBM25F, crearResolver, zonaDe } from '../../src/motor/resolver.js';
import { crearTerminos } from '../../src/motor/normalizar.js';
import { cargarIndice, cargarPreguntas, particion, esperaContacto, argumentos, FIXTURE_PLAYA } from './datos.mjs';
import { metricas, cumple, resumen, OBJETIVO } from './metricas.mjs';

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

/** Calibra motor y zonas con la partición de ajuste. Devuelve { config, ajuste, validacion, escala }. */
export function calibrar(datos, consultas, objetivo = OBJETIVO) {
  const { ajuste, validacion } = particion(consultas);
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
  let mejor = null;
  for (const Ta of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1])
    for (const Ca of [0.5, 0.6, 0.7, 0.8, 0.9])
      for (const Ma of [0, 0.05, 0.1, 0.2, 0.3])
        for (const Tm of [0.05, 0.1, 0.15, 0.2, 0.3])
          for (const Cm of [0.2, 0.3, 0.4, 0.5]) {
            if (Tm > Ta || Cm > Ca) continue;
            const u = { Ta, Ca, Ma, Tm, Cm };
            const m = metricas(aFilas(corridasAjuste, u));
            const deficit =
              Math.max(0, objetivo.precisionAlta - m.precisionAlta) + Math.max(0, m.fuga - objetivo.fuga) + Math.max(0, m.falsoRechazo - objetivo.falsoRechazo);
            const clave = [-deficit, m.aciertoTotal, m.top1, m.altas];
            if (!mejor || compararClaves(clave, mejor.clave) > 0) mejor = { u, clave };
          }
  const zonas = mejor.u;

  return {
    config: { ...datos.config, motor, zonas },
    escala: resolvedor.escala,
    ajuste: { n: ajuste.length, metricas: metricas(aFilas(corridasAjuste, zonas)) },
    validacion: { n: validacion.length, metricas: metricas(aFilas(corrida(validacion), zonas)) },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = argumentos();
  const rutaIndice = args.indice ?? `${FIXTURE_PLAYA}indice.json`;
  const datos = cargarIndice(rutaIndice);
  const r = calibrar(datos, cargarPreguntas(args.preguntas));
  console.log('motor', JSON.stringify(r.config.motor));
  console.log('zonas', JSON.stringify(r.config.zonas));
  console.log(`Escala del puntaje: ${r.escala.toFixed(2)}`);
  console.log(`Ajuste (${r.ajuste.n}): ${resumen(r.ajuste.metricas)}`);
  console.log(`Validación (${r.validacion.n}): ${resumen(r.validacion.metricas)}`, cumple(r.validacion.metricas) ? '· cumple' : '· NO cumple');
  if (process.argv.includes('--escribir')) {
    writeFileSync(rutaIndice, `${JSON.stringify({ ...datos, config: r.config }, null, 2)}\n`);
    console.log(`config escrita en ${rutaIndice}`);
  }
}
