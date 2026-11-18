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
  };
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
    const lista = res.zona === 'baja' ? ['contacto'] : resolvedor.buscar(c.consulta).map((x) => x.id);
    return { c, res, d: { zona: res.zona === 'baja' ? 'contacto' : res.zona, lista } };
  });
}

const p = (x) => `${(x * 100).toFixed(1)}%`;

/** Una línea legible con las métricas principales. */
export const resumen = (m) =>
  `top-1 ${p(m.top1)} · top-3 ${p(m.top3)} · MRR ${m.mrr.toFixed(3)} · prec. alta ${p(m.precisionAlta)} (${p(m.altas)} en alta) · fuga ${p(m.fuga)} · falso rechazo ${p(m.falsoRechazo)}`;
