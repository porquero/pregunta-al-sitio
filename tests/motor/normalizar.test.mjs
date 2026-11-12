// Normalización del buscador y diccionario de sinónimos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, raiz, terminos, trigramas, crearTerminos, prepararDiccionario, DICCIONARIO_BASE } from '../../src/motor/normalizar.js';
import { cargarIndice } from '../../cli/evaluacion/datos.mjs';

const terminosPlaya = crearTerminos(cargarIndice().diccionario);

test('quita tildes, mayúsculas y signos', () => {
  assert.equal(normalizar('¿Qué ÉS la Integración?'), 'que es la integracion');
  assert.equal(normalizar('Cañón, "año" 24/7'), 'canon ano 24 7');
});

test('une los miles para que la ley se escriba igual con o sin punto', () => {
  assert.deepEqual(terminos('Ley 21.719'), terminos('ley 21719'));
});

test('la derivación junta las formas de una misma palabra', () => {
  for (const grupo of [
    ['automatización', 'automatizar', 'automatizan', 'automatizaciones'],
    ['integración', 'integrar', 'integran'],
    ['respaldo', 'respaldos'],
    ['servicio', 'servicios'],
    ['desarrollo', 'desarrollan', 'desarrollar'],
  ]) {
    const raices = new Set(grupo.map((p) => terminos(p)[0]));
    assert.equal(raices.size, 1, `${grupo.join(', ')} → ${[...raices].join(', ')}`);
  }
});

test('la raíz conserva al menos cuatro letras', () => {
  assert.equal(raiz('datos'), 'dato');
  assert.equal(raiz('crm'), 'crm');
  assert.equal(raiz('n8n'), 'n8n');
});

test('el diccionario base junta variantes ortográficas comunes', () => {
  assert.deepEqual(terminos('wasap'), terminos('WhatsApp'));
  assert.deepEqual(terminos('e-mail'), terminos('correo'));
  assert.deepEqual(terminos('gratis'), terminos('gratuita'));
  assert.deepEqual(terminos('inteligencia artificial'), terminos('IA'));
});

test('el diccionario base no trae vocabulario de un sitio', () => {
  assert.notDeepEqual(terminos('bot'), terminos('chatbot'));
  assert.notDeepEqual(terminos('wsp'), terminos('whatsapp'));
  assert.notDeepEqual(terminos('¿Cuánto cuesta?'), terminos('cotización'));
});

test('el diccionario del sitio se suma a la base', () => {
  const t = terminosPlaya;
  assert.deepEqual(t('wsp'), t('WhatsApp'));
  assert.deepEqual(t('wasap'), t('WhatsApp'));
  assert.deepEqual(t('¿Cuánto cuesta?'), t('cotización'));
  assert.deepEqual(t('mis planillas'), t('mi Excel'));
  assert.deepEqual(t('alojamiento web'), t('hosting'));
  assert.deepEqual(t('cabañas'), t('hostal'));
  assert.deepEqual(t('bot'), t('chatbot'));
});

test('el sitio puede reemplazar o quitar entradas de la base y escribirlas con tildes', () => {
  const t = crearTerminos({ gratis: 'sin cargo', mail: null, 'Páginas Web': 'sitioweb' });
  assert.deepEqual(t('gratis'), t('sin cargo'));
  assert.deepEqual(t('mail'), ['mail']);
  assert.deepEqual(t('paginas web'), t('sitioweb'));
  assert.ok(Object.keys(DICCIONARIO_BASE).length > 0);
  assert.equal(prepararDiccionario({}, {}).largoMax, 0);
  assert.deepEqual(crearTerminos({})('hola mundo'), terminos('mundo'));
});

test('quita stopwords salvo que la consulta sea solo eso', () => {
  assert.deepEqual(terminos('¿Qué es lo que hacen ustedes con el hosting?'), ['hosting']);
  assert.deepEqual(terminos('hola'), ['hola']);
  assert.ok(terminos('¿qué no hacen?').includes('no'));
});

test('trigramas con bordes', () => {
  assert.deepEqual(trigramas('crm'), [' cr', 'crm', 'rm ']);
});
