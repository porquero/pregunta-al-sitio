// Prioridad por tipo de nodo (config.tipos), segunda vuelta, desempate, consultas cortas y saturación
// de la frecuencia en preguntas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearResolver, crearBM25F, ajustarPorTipo, desempatar, zonaVueltas, senales, terminosReferencia, configDe,
} from '../../src/motor/resolver.js';
import { crearTerminos } from '../../src/motor/normalizar.js';
import { cargarIndice } from '../../cli/evaluacion/datos.mjs';

const nodo = (id, tipo, extra = {}) => ({ id, tipo, titulo: id, preguntas: [], keywords: [], sinonimos: [], ...extra });

// Un servicio y un artículo que comparten vocabulario; el artículo repite "wotel" en sus preguntas.
const NODOS = [
  nodo('inicio', 'saludo', { titulo: 'Hola', preguntas: ['hola'] }),
  nodo('contacto', 'contacto', { titulo: 'Contacto', preguntas: ['¿cómo los contacto?', 'quiero hablar con alguien'], keywords: ['contacto', 'correo'] }),
  nodo('wotel', 'producto', {
    titulo: 'Wotel, gestión hotelera',
    preguntas: ['¿Qué es Wotel?', '¿Tienen un sistema para hoteles?', 'software para mi hotel', 'reservas del hotel'],
    keywords: ['wotel', 'hotel', 'reservas'],
  }),
  nodo('art-wotel', 'articulo', {
    titulo: 'El problema real detrás de Wotel',
    preguntas: ['¿Por qué crearon Wotel?', 'historia de Wotel', 'Wotel nació de un problema', '¿Wotel sirve para hostales?', 'lo que aprendimos con Wotel'],
    keywords: ['wotel', 'historia'],
  }),
  nodo('automatizacion', 'servicio', {
    titulo: 'Automatización de procesos',
    preguntas: ['¿Automatizan procesos?', 'quiero dejar de usar excel', 'sistema que automatice tareas'],
    keywords: ['automatizacion', 'procesos', 'excel'],
  }),
  nodo('art-automatizar', 'articulo', {
    titulo: 'Qué problemas resuelve automatizar',
    preguntas: ['¿Qué problemas resuelve automatizar?', 'problemas de usar excel', 'ventajas de automatizar procesos'],
    keywords: ['automatizacion', 'procesos', 'excel'],
  }),
  nodo('guia-bpm', 'articulo', { titulo: 'Guía de BPM', preguntas: ['¿Qué es BPM?', 'modelar procesos con BPM'], keywords: ['bpm'] }),
];

const indice = (config = {}) => ({ version: 't', nodos: NODOS, config, ambito: {}, diccionario: {} });
const TIPOS = { articulo: { peso: 0.6 } };

test('sin config.tipos el resolvedor se comporta como antes', () => {
  const datos = cargarIndice();
  const r = crearResolver(datos);
  const viejo = crearBM25F(datos.nodos, configDe(datos).motor, crearTerminos(datos.diccionario));
  for (const q of ['¿Tienen hosting?', 'quiero automatizar procesos', 'precio', 'wsp']) {
    assert.deepEqual(r.buscar(q).map((x) => x.id), viejo.buscar(q).map((x) => x.id), q);
    assert.equal(r.resolver(q).vuelta, 0);
  }
  assert.equal(r.respaldo.size, 0);
});

test('ajustarPorTipo multiplica el puntaje y reordena; desempatar sube la oferta en un empate cercano', () => {
  const tipoDe = (id) => ({ a: 'articulo', s: 'servicio' })[id];
  const ajustado = ajustarPorTipo([{ id: 'a', puntaje: 10 }, { id: 's', puntaje: 8 }], tipoDe, TIPOS);
  assert.deepEqual(ajustado.map((r) => [r.id, r.puntaje, r.base]), [['s', 8, 8], ['a', 6, 10]]);
  assert.equal(ajustarPorTipo([{ id: 'a', puntaje: 1 }], tipoDe, {})[0].base, undefined, 'sin tipos no cambia nada');

  const prioridad = (id) => ({ a: 0.8, s: 1 })[id] ?? 1;
  const empate = [{ id: 'a', puntaje: 10 }, { id: 's', puntaje: 9.8 }, { id: 'x', puntaje: 5 }];
  assert.deepEqual(desempatar(empate, prioridad, 0.05).map((r) => r.id), ['s', 'a', 'x']);
  assert.deepEqual(desempatar(empate, prioridad, 0.01).map((r) => r.id), ['a', 's', 'x'], 'fuera del umbral manda el puntaje');
  assert.deepEqual(desempatar(empate, () => 1, 0.05).map((r) => r.id), ['a', 's', 'x'], 'con la misma prioridad no cambia');
});

test('con peso de tipo, el servicio gana al artículo que comparte vocabulario', () => {
  const q = 'tengo una empresa que usa excel y quiero un sistema que automatice';
  const sinTipos = crearResolver(indice()).buscar(q).map((r) => r.id);
  const conTipos = crearResolver(indice({ tipos: TIPOS })).buscar(q).map((r) => r.id);
  assert.equal(conTipos[0], 'automatizacion');
  assert.ok(conTipos.indexOf('art-automatizar') > conTipos.indexOf('automatizacion'));
  assert.ok(sinTipos.includes('art-automatizar'));
  // El contenido sigue respondiendo cuando ningún servicio coincide.
  assert.equal(crearResolver(indice({ tipos: TIPOS })).resolver('¿Qué es BPM?').nodos[0], 'guia-bpm');
});

test('zonaVueltas: la segunda vuelta solo entra si la primera cae en zona baja', () => {
  const u = { Ta: 0.5, Ca: 0.5, Ma: 0, Tm: 0.3, Cm: 0.2 };
  const alta = { norm: 1, cobertura: 1, margen: 1 };
  const baja = { norm: 0, cobertura: 0, margen: 0 };
  assert.deepEqual(zonaVueltas('sitio', [alta, baja], u), { zona: 'alta', vuelta: 0 });
  assert.deepEqual(zonaVueltas('sitio', [baja, alta], u), { zona: 'alta', vuelta: 1 });
  assert.deepEqual(zonaVueltas('sitio', [baja, baja], u), { zona: 'baja', vuelta: 0 });
  assert.deepEqual(zonaVueltas('general', [baja, alta], u), { zona: 'baja', vuelta: 0 });
  assert.deepEqual(zonaVueltas('sitio', [alta], u), { zona: 'alta', vuelta: 0 });
});

test('respaldo: el contenido no se ofrece si la primera vuelta tiene opciones; responde si no las hay', () => {
  const r = crearResolver(indice({ tipos: { articulo: { respaldo: true } }, zonas: { Ta: 0.5, Ca: 0.5, Ma: 0, Tm: 0.05, Cm: 0.2 } }));
  assert.deepEqual([...r.respaldo].sort(), ['art-automatizar', 'art-wotel', 'guia-bpm']);
  const excel = r.resolver('problemas de usar excel');
  assert.equal(excel.vuelta, 0);
  assert.ok(!excel.nodos.some((id) => id.startsWith('art-')), excel.nodos.join());
  // El orden completo deja el respaldo al final (para las métricas de top-3).
  assert.ok(excel.orden.indexOf('art-automatizar') > excel.orden.indexOf('automatizacion'));
  const bpm = r.resolver('¿Qué es BPM?');
  assert.equal(bpm.vuelta, 1);
  assert.deepEqual(bpm.nodos, ['guia-bpm']);
});

test('consultas cortas: la normalización por términos no castiga una palabra con cobertura completa', () => {
  const resultados = [{ id: 'a', puntaje: 4, cobertura: 1 }, { id: 'b', puntaje: 2, cobertura: 1 }];
  assert.equal(senales(resultados, 10).norm, 0.4);
  assert.equal(senales(resultados, 10, { terminos: 1, referencia: 4 }).norm, 1.6);
  assert.equal(senales(resultados, 10, { terminos: 5, referencia: 4 }).norm, 0.4, 'las largas no cambian');
  assert.equal(terminosReferencia(NODOS.slice(2, 3)), 2);
  const zonas = { Ta: 0.5, Ca: 0.5, Ma: 0, Tm: 0.3, Cm: 0.2 };
  const sin = crearResolver(indice({ zonas })).resolver('reservas');
  const con = crearResolver(indice({ zonas, normaPorTerminos: true })).resolver('reservas');
  assert.ok(con.senales.norm > sin.senales.norm);
});

test('saturación en preguntas: repetir un término en todas las preguntas suma menos', () => {
  const terminos = crearTerminos({});
  const lineal = crearBM25F(NODOS, {}, terminos).buscar('wotel');
  const saturado = crearBM25F(NODOS, { tfLog: ['preguntas'] }, terminos).buscar('wotel');
  const ventaja = (rs) => rs.find((r) => r.id === 'wotel').puntaje - rs.find((r) => r.id === 'art-wotel').puntaje;
  assert.ok(ventaja(saturado) > ventaja(lineal), 'el nodo principal saca más ventaja');
  // Con el peso de tipo además, el principal queda primero.
  const ambos = crearResolver(indice({ tipos: TIPOS, motor: { tfLog: ['preguntas'] } })).buscar('wotel');
  assert.equal(ambos[0].id, 'wotel');
});

test('configDe completa tipos, empate y normaPorTerminos con los valores por defecto', () => {
  const c = configDe({ config: { tipos: { articulo: { peso: 0.6 } }, opcionesMedia: 3 } });
  assert.deepEqual(c.tipos, { articulo: { peso: 0.6, respaldo: false } });
  assert.equal(c.opcionesMedia, 3);
  assert.equal(c.empate, 0.05);
  assert.equal(c.normaPorTerminos, false);
});
