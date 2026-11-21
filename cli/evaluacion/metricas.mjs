// Métricas de la evaluación, compartidas por evaluar.mjs, calibrar.mjs y los tests.
// Cada fila es { c: consulta del set, d: { zona: alta|media|mixta|contacto, lista: ids en orden } }.
import { esperaContacto } from './datos.mjs';

export function metricas(filas) {
  const deNodo = filas.filter((f) => !esperaContacto(f.c));
  const soloNodo = deNodo.filter((f) => !f.c.esperado.includes('contacto'));
  const generales = filas.filter((f) => f.c.tipo === 'general');
  const ajenasContacto = filas.filter((f) => f.c.tipo === 'ajena' && esperaContacto(f.c));
  const altas = filas.filter((f) => f.d.zona === 'alta');
  const terminaEnContacto = (f) => f.d.zona === 'contacto' || (f.d.lista[0] === 'contacto' && f.d.zona !== 'mixta');
  const respondeConNodo = (f) => (f.d.zona === 'alta' || f.d.zona === 'media') && f.d.lista[0] !== 'contacto';
  const rango = (f) => {
    const i = f.d.lista.slice(0, 10).findIndex((id) => f.c.esperado.includes(id));
    return i < 0 ? 0 : i + 1;
  };
  const pct = (a, b) => (b ? a / b : 0);
  const correcta = (f) => (esperaContacto(f.c) ? terminaEnContacto(f) : f.c.esperado.includes(f.d.lista[0]));
  return {
    n: filas.length,
    top1: pct(deNodo.filter((f) => rango(f) === 1).length, deNodo.length),
    top3: pct(deNodo.filter((f) => rango(f) >= 1 && rango(f) <= 3).length, deNodo.length),
    mrr: pct(deNodo.reduce((s, f) => s + (rango(f) ? 1 / rango(f) : 0), 0), deNodo.length),
    precisionAlta: pct(altas.filter(correcta).length, altas.length),
    altas: pct(altas.length, filas.length),
    fuga: pct(generales.filter(respondeConNodo).length, generales.length),
    generalesMixtas: pct(generales.filter((f) => f.d.zona === 'mixta').length, generales.length),
    falsoRechazo: pct(soloNodo.filter(terminaEnContacto).length, soloNodo.length),
    ruidoRespondido: pct(ajenasContacto.filter(respondeConNodo).length, ajenasContacto.length),
    aciertoTotal: pct(filas.filter(correcta).length, filas.length),
    // Denominadores de cada tasa, para los intervalos de confianza.
    base: { top1: deNodo.length, top3: deNodo.length, precisionAlta: altas.length, fuga: generales.length, falsoRechazo: soloNodo.length },
  };
}

/** Intervalo de Wilson al 95 % para una proporción p medida sobre n casos: [inferior, superior]. */
export function wilson(p, n, z = 1.96) {
  if (!n) return [0, 1];
  const z2 = z * z;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const radio = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centro - radio), Math.min(1, centro + radio)];
}

/** Validación con menos consultas que esto: cada error mueve demasiado las métricas. */
export const VALIDACION_MIN = 100;
/** Diferencia de top-3 entre ajuste y validación sobre la que se avisa de sobreajuste (puntos). */
export const SOBREAJUSTE_MAX = 0.08;

/** Avisos sobre la confianza de la validación: tamaño y diferencia con el ajuste. */
export function avisosValidacion(ajuste, validacion) {
  const avisos = [];
  if (validacion.n < VALIDACION_MIN) {
    avisos.push(`la validación tiene ${validacion.n} consultas (menos de ${VALIDACION_MIN}): un error mueve el top-3 en ${(100 / (validacion.base.top3 || 1)).toFixed(1)} puntos; agrega consultas al set`);
  }
  const brecha = ajuste.top3 - validacion.top3;
  if (brecha > SOBREAJUSTE_MAX) {
    avisos.push(`top-3 de ajuste ${p(ajuste.top3)} y de validación ${p(validacion.top3)} (${(brecha * 100).toFixed(1)} puntos): probable sobreajuste del contenido al set`);
  }
  return avisos;
}

/** Métricas de validación con su intervalo de Wilson al 95 %. */
export function intervalos(m) {
  const linea = (clave, nombre) => {
    const [a, b] = wilson(m[clave], m.base[clave]);
    return `${nombre} ${p(m[clave])} [${p(a)}–${p(b)}, n ${m.base[clave]}]`;
  };
  return [linea('top3', 'top-3'), linea('top1', 'top-1'), linea('precisionAlta', 'prec. alta'), linea('falsoRechazo', 'falso rechazo'), linea('fuga', 'fuga')].join(' · ');
}

/** Objetivos de calidad de un sitio. */
export const OBJETIVO = { top3: 0.9, precisionAlta: 0.95, fuga: 0.03, falsoRechazo: 0.05 };

/**
 * Objetivo al elegir umbrales en la calibración: más exigente en precisión alta que el mínimo, para que
 * la validación quede con holgura. Una consulta dudosa pasa a "¿Te refieres a A o B?" en vez de
 * responderse mal.
 */
export const OBJETIVO_CALIBRACION = { ...OBJETIVO, precisionAlta: 0.99 };

export const cumple = (m, o = OBJETIVO) =>
  m.top3 >= o.top3 && m.precisionAlta >= o.precisionAlta && m.fuga <= o.fuga && m.falsoRechazo <= o.falsoRechazo;

/** Filas de métricas para un resolvedor ya armado: la zona baja cuenta como contacto. */
export function filasDe(resolvedor, consultas) {
  return consultas.map((c) => {
    const res = resolvedor.resolver(c.consulta);
    const lista = res.zona === 'baja' ? ['contacto'] : res.orden;
    return { c, res, d: { zona: res.zona === 'baja' ? 'contacto' : res.zona, lista } };
  });
}

const p = (x) => `${(x * 100).toFixed(1)}%`;

/** Una línea legible con las métricas principales. */
export const resumen = (m) =>
  `top-1 ${p(m.top1)} · top-3 ${p(m.top3)} · MRR ${m.mrr.toFixed(3)} · prec. alta ${p(m.precisionAlta)} (${p(m.altas)} en alta) · fuga ${p(m.fuga)} · falso rechazo ${p(m.falsoRechazo)}`;
