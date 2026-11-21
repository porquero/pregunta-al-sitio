// Evaluación del resolvedor de un sitio con la configuración de su índice (pregunta-al-sitio evaluar).
// Informa las métricas en la partición de validación (40 %, no se usa para calibrar) y en la de ajuste,
// las métricas por tipo de consulta, los errores, la fuga sin detector de ámbito, y el tamaño y los
// tiempos de carga y consulta.
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { crearResolver, zonaDe, pesoTipo } from '../../src/motor/resolver.js';
import { particion, esperaContacto, medibles, SIN_METRICAS } from './datos.mjs';
import { metricas, filasDe, avisosValidacion } from './metricas.mjs';

/**
 * Familia de una consulta según los nodos que espera: respaldo si todos son de un tipo de respaldo o con
 * peso menor que 1 (contenido), oferta en otro caso. Las que esperan solo contacto no tienen familia.
 */
export function familiaDe(c, tipoDe, tipos) {
  if (esperaContacto(c)) return null;
  const deRespaldo = (id) => {
    const t = tipos[tipoDe.get(id)];
    return Boolean(t?.respaldo) || pesoTipo(tipos, tipoDe.get(id)) < 1;
  };
  return c.esperado.filter((id) => id !== 'contacto').every(deRespaldo) ? 'respaldo' : 'oferta';
}

export const FACTOR_MOVIL = 4; // estimación: CPU de un teléfono de gama media frente a un PC de desarrollo

const esError = (f) =>
  esperaContacto(f.c) ? !(f.d.zona === 'contacto' || f.d.lista[0] === 'contacto') : !f.c.esperado.includes(f.d.lista[0]);

function medir(datos, consultas) {
  const json = JSON.stringify(datos);
  const repeticiones = 20;
  let t0 = performance.now();
  let r;
  for (let i = 0; i < repeticiones; i++) r = crearResolver(JSON.parse(json));
  const carga = (performance.now() - t0) / repeticiones;
  t0 = performance.now();
  const vueltas = 5;
  for (let v = 0; v < vueltas; v++) for (const c of consultas) r.resolver(c.consulta);
  const consulta = (performance.now() - t0) / (vueltas * consultas.length);
  return { carga, consulta, indice: Buffer.byteLength(json), indiceGz: gzipSync(json).length };
}

export function evaluar(datos, todas, { medicion = true } = {}) {
  const r = crearResolver(datos);
  const consultas = medibles(todas);
  const { ajuste, validacion } = particion(consultas);
  // Seguimiento: fuera de las métricas; se informa el acierto sin contexto, como responde el chat.
  const seguimiento = todas.filter((c) => SIN_METRICAS.includes(c.tipo));
  const filasS = filasDe(r, seguimiento);
  const filasV = filasDe(r, validacion);
  const filasA = filasDe(r, ajuste);
  // Fuga si el detector de ámbito no existiera: solo decide el puntaje.
  const generales = filasV.filter((f) => f.c.tipo === 'general');
  const fugaSinDetector = generales.filter((f) => {
    const zona = zonaDe('neutro', f.res.senales, r.config.zonas);
    return zona === 'alta' || zona === 'media';
  }).length / (generales.length || 1);
  const detalle = (f) => ({
    consulta: f.c.consulta,
    tipo: f.c.tipo,
    esperado: f.c.esperado,
    zona: f.d.zona,
    obtenido: f.d.lista.slice(0, 3),
    top: f.res.candidatos.map((x) => `${x.id} ${x.puntaje.toFixed(2)}`),
    senales: f.res.senales,
  });
  // Por familia (oferta frente a respaldo), solo si el sitio declara config.tipos.
  const tipos = r.config.tipos;
  const tipoDe = new Map(datos.nodos.map((n) => [n.id, n.tipo]));
  const porFamilia = Object.keys(tipos).length
    ? Object.fromEntries(['oferta', 'respaldo'].map((fam) => [fam, metricas(filasV.filter((f) => familiaDe(f.c, tipoDe, tipos) === fam))]))
    : null;
  const segundaVuelta = r.respaldo.size
    ? { validacion: filasV.filter((f) => f.res.vuelta === 1).length, ajuste: filasA.filter((f) => f.res.vuelta === 1).length }
    : null;
  const validacionM = metricas(filasV);
  const ajusteM = metricas(filasA);
  return {
    version: datos.version,
    config: r.config,
    escala: r.escala,
    tamanos: { ajuste: ajuste.length, validacion: validacion.length, seguimiento: seguimiento.length },
    seguimiento: { n: seguimiento.length, acierto: filasS.filter((f) => !esError(f)).length / (seguimiento.length || 1), errores: filasS.filter(esError).map((f) => ({ ...detalle(f), contexto: f.c.contexto })) },
    validacion: validacionM,
    ajuste: ajusteM,
    avisos: avisosValidacion(ajusteM, validacionM),
    porFamilia,
    segundaVuelta,
    validacionPorTipo: Object.fromEntries(
      [...new Set(validacion.map((c) => c.tipo))].map((t) => [t, metricas(filasV.filter((f) => f.c.tipo === t))]),
    ),
    errores: filasV.filter(esError).map(detalle),
    erroresAjuste: filasA.filter(esError).map(detalle),
    fugaSinDetector,
    medicion: medicion ? medir(datos, consultas) : null,
  };
}
