// Detector de ámbito contra los casos de frontera del fixture de Playa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearTerminos } from '../../src/motor/normalizar.js';
import { prepararAmbito, clasificarAmbito } from '../../src/motor/ambito.js';
import { cargarIndice, cargarCasosAmbito } from '../../cli/evaluacion/datos.mjs';

const datos = cargarIndice();
const { nodos, ambito: reglas } = datos;
const ambito = prepararAmbito(reglas, nodos, crearTerminos(datos.diccionario));
const casos = cargarCasosAmbito();

test('hay al menos 40 casos de frontera', () => {
  assert.ok(casos.length >= 40, `${casos.length} casos`);
});

test('clasifica cada caso de frontera', (t) => {
  const fallos = [];
  for (const c of casos) {
    const r = clasificarAmbito(c.consulta, ambito);
    if (r.tipo !== c.ambito) fallos.push(`"${c.consulta}": esperado ${c.ambito}, obtuvo ${r.tipo}`);
  }
  const porTipo = {};
  for (const c of casos) {
    porTipo[c.ambito] ??= { total: 0, bien: 0 };
    porTipo[c.ambito].total++;
    if (clasificarAmbito(c.consulta, ambito).tipo === c.ambito) porTipo[c.ambito].bien++;
  }
  t.diagnostic(Object.entries(porTipo).map(([k, v]) => `${k} ${v.bien}/${v.total}`).join(' · '));
  assert.deepEqual(fallos, []);
});

test('derivar también calza por términos con el diccionario: "precio sistema" detecta "cuánto cuesta un sistema"', () => {
  const terminos = crearTerminos({ 'cuanto cuesta': 'precio' });
  const a = prepararAmbito({ derivar: ['precio sistema', 'empleo'] }, [], terminos);
  assert.equal(clasificarAmbito('¿Cuánto cuesta un sistema?', a).tipo, 'derivar');
  assert.equal(clasificarAmbito('precio del sistema', a).tipo, 'derivar');
  assert.equal(clasificarAmbito('busco empleo', a).tipo, 'derivar');
  assert.notEqual(clasificarAmbito('¿cuántos empleados tienen?', a).tipo, 'derivar', 'sin derivación de palabras: empleo no es empleados');
  assert.notEqual(clasificarAmbito('sistema de precios', a).tipo, 'derivar', 'el orden de los términos importa');
});

test('excluir_si: una palabra de tema ajeno vuelve general la consulta, salvo que nombre una marca', () => {
  const a = prepararAmbito({ marcas: ['acme'], excluir_si: ['japon', 'clima'] }, [{ keywords: ['hora gratuita'] }], crearTerminos({}));
  assert.equal(clasificarAmbito('qué hora es en Japón', a).tipo, 'general');
  assert.equal(clasificarAmbito('clima en la serena', a).tipo, 'general');
  assert.equal(clasificarAmbito('¿Acme trabaja con clientes en Japón?', a).tipo, 'sitio');
  assert.equal(clasificarAmbito('hora gratuita', a).tipo, 'sitio');
});
