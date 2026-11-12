// Resolvedor con el fixture de Playa y la configuración de su índice.
// Criterio de aceptación: el motor cumple los objetivos de calidad en la partición de validación y
// conserva las métricas que tenía en Playa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearResolver } from '../../src/motor/resolver.js';
import { cargarIndice, cargarPreguntas, particion } from '../../cli/evaluacion/datos.mjs';
import { metricas, filasDe } from '../../cli/evaluacion/metricas.mjs';
import { MOTOR, ZONAS } from '../../src/motor/config.js';

const datos = cargarIndice();
const r = crearResolver(datos);
const { validacion } = particion(cargarPreguntas());

const filas = filasDe(r, validacion);
const m = metricas(filas);

test('cumple los objetivos de calidad en validación', (t) => {
  const p = (x) => `${(x * 100).toFixed(1)}%`;
  t.diagnostic(`top-1 ${p(m.top1)} · top-3 ${p(m.top3)} · prec. alta ${p(m.precisionAlta)} · fuga ${p(m.fuga)} · falso rechazo ${p(m.falsoRechazo)}`);
  assert.ok(m.top3 >= 0.9, `top-3 ${m.top3}`);
  assert.ok(m.precisionAlta >= 0.95, `precisión alta ${m.precisionAlta}`);
  assert.ok(m.fuga <= 0.03, `fuga ${m.fuga}`);
  assert.ok(m.falsoRechazo <= 0.05, `falso rechazo ${m.falsoRechazo}`);
});

test('conserva las métricas de Playa en validación', () => {
  const redondo = (x) => Math.round(x * 1000) / 10;
  assert.deepEqual(
    { top1: redondo(m.top1), top3: redondo(m.top3), precisionAlta: redondo(m.precisionAlta), fuga: redondo(m.fuga), falsoRechazo: redondo(m.falsoRechazo) },
    { top1: 89.8, top3: 95.9, precisionAlta: 100, fuga: 0, falsoRechazo: 4.5 },
  );
});

test('toma motor, zonas y opciones de la zona media desde datos.config', () => {
  assert.deepEqual(crearResolver({ nodos: [] }).config.zonas, ZONAS);
  assert.equal(crearResolver({ nodos: [] }).config.motor.k1, MOTOR.k1);
  const propio = crearResolver({ ...datos, config: { motor: { k1: 0.9, pesos: { keywords: 5 } }, zonas: { Ta: 99 }, opcionesMedia: 3 } });
  assert.equal(propio.config.motor.k1, 0.9);
  assert.equal(propio.config.motor.pesos.keywords, 5);
  assert.equal(propio.config.motor.pesos.titulo, MOTOR.pesos.titulo);
  assert.equal(propio.config.zonas.Ta, 99);
  assert.equal(propio.config.zonas.Ca, ZONAS.Ca);
  // Con Ta inalcanzable nada queda en zona alta.
  assert.notEqual(propio.resolver('¿Tienen hosting con respaldo?').zona, 'alta');
  const media = propio.resolver('como hacen lo que hacen');
  assert.equal(media.zona, 'media');
  assert.equal(media.nodos.length, 3);
});

test('las opciones explícitas reemplazan la configuración del índice', () => {
  const r2 = crearResolver(datos, { zonas: { Ta: 0, Ca: 0, Ma: 0, Tm: 0, Cm: 0 } });
  assert.equal(r2.resolver('¿Tienen hosting con respaldo?').zona, 'alta');
});

test('usa el diccionario del índice', () => {
  assert.deepEqual(r.terminos('wsp'), r.terminos('whatsapp'));
  const sinDiccionario = crearResolver({ ...datos, diccionario: {} });
  assert.notDeepEqual(sinDiccionario.terminos('wsp'), sinDiccionario.terminos('whatsapp'));
});

test('informa la precisión por zona', (t) => {
  for (const zona of ['alta', 'media', 'mixta', 'baja']) {
    const enZona = filas.filter((f) => f.res.zona === zona);
    const bien = enZona.filter((f) =>
      zona === 'baja' ? f.c.esperado.includes('contacto') : f.c.esperado.includes(f.res.nodos[0]) || f.res.nodos.some((id) => f.c.esperado.includes(id)),
    );
    t.diagnostic(`${zona}: ${bien.length}/${enZona.length}`);
  }
});

test('conocimiento general y temas fuera de la lista van a contacto con el texto de derivación', () => {
  for (const q of ['¿Qué es un CRM?', '¿Quién ganó el mundial de 2022?', 'Quiero enviar mi currículum', '¿Tienen un blog?']) {
    const res = r.resolver(q);
    assert.equal(res.zona, 'baja', q);
    assert.deepEqual(res.nodos, ['contacto'], q);
    assert.match(res.derivacion, /Este asistente responde sobre Playa SPA/, q);
  }
});

test('preguntas de la lista responden con su nodo primero', () => {
  // Las consultas cortas puntúan bajo la escala y pueden quedar en zona media ("¿Te refieres a A o B?").
  for (const [q, ids] of [
    ['¿Tienen hosting?', ['hosting-empresarial']],
    ['¿Qué es Wotel?', ['wotel']],
    ['¿Qué es EspoCRM?', ['stack-tecnologico', 'crm-sistemas-negocio']],
    ['¿Cómo protegen la información de mi empresa?', ['seguridad-informacion']],
  ]) {
    const res = r.resolver(q);
    assert.ok(['alta', 'media'].includes(res.zona), `${q}: ${res.zona}`);
    assert.ok(ids.includes(res.nodos[0]), `${q}: ${res.nodos[0]}`);
    assert.equal(res.derivacion, null);
  }
});

test('la zona mixta ofrece un nodo del sitio', () => {
  const res = r.resolver('¿Cómo funciona un CRM para mi negocio?');
  assert.equal(res.zona, 'mixta');
  assert.equal(res.nodos.length, 1);
});

test('la zona media ofrece dos nodos', () => {
  const media = filas.find((f) => f.res.zona === 'media');
  assert.ok(media, 'hay al menos una consulta en zona media');
  assert.equal(media.res.nodos.length, 2);
});

test('la zona media no ofrece el saludo si hay otras opciones', () => {
  const saludos = new Set(datos.nodos.filter((n) => n.tipo === 'saludo').map((n) => n.id));
  const res = r.resolver('como hacen lo que hacen');
  assert.equal(res.zona, 'media');
  assert.ok(r.buscar('como hacen lo que hacen').slice(0, 2).some((x) => saludos.has(x.id)), 'el saludo está entre los primeros');
  assert.equal(res.nodos.length, 2);
  for (const id of res.nodos) assert.ok(!saludos.has(id), `ofrece el saludo ${id}`);
});

test('solo devuelve tokens normalizados para registrar consultas sin respuesta', () => {
  const res = r.resolver('¿Cuánto cuesta el Hosting de ustedes?');
  for (const t of res.terminos) assert.match(t, /^[a-z0-9]+$/);
});
