// Partes puras del widget: opciones, textos y contacto. El DOM se prueba en el navegador con dev/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOpciones, opcionesDeAtributos, formatear, preguntaOpciones, avisoContacto, TEXTOS } from '../../src/widget/opciones.js';
import { enlaceContacto, cuerpoContacto, erroresContacto, enviarContacto } from '../../src/widget/contacto.js';
import { RETARDO_MS, CLAVE_SESION } from '../../src/motor/config.js';

test('las opciones exigen el índice y completan los valores por defecto', () => {
  assert.throws(() => normalizarOpciones({}), /falta la opción "indice"/);
  const o = normalizarOpciones({ indice: '/i.json' });
  assert.equal(o.posicion, 'derecha');
  assert.equal(o.tema, 'claro');
  assert.equal(o.retardo, RETARDO_MS);
  assert.equal(o.clave, CLAVE_SESION);
  assert.equal(o.contacto, null);
  assert.equal(o.textos.boton, TEXTOS.titulo);
});

test('el título y los textos se pueden cambiar', () => {
  const o = normalizarOpciones({ indice: '/i.json', titulo: 'Ayuda', textos: { enviar: 'Mandar' }, posicion: 'izquierda', tema: 'auto', retardo: 0 });
  assert.equal(o.textos.titulo, 'Ayuda');
  assert.equal(o.textos.boton, 'Ayuda');
  assert.equal(o.textos.enviar, 'Mandar');
  assert.equal(o.posicion, 'izquierda');
  assert.equal(o.tema, 'auto');
  assert.equal(o.retardo, 0);
  assert.equal(normalizarOpciones({ indice: 'x', posicion: 'arriba', tema: 'rosa', retardo: -1 }).posicion, 'derecha');
});

test('contacto por enlace o por webhook', () => {
  assert.deepEqual(normalizarOpciones({ indice: 'x', contacto: { enlace: 'mailto:a@b.cl?body={mensaje}' } }).contacto, { tipo: 'enlace', enlace: 'mailto:a@b.cl?body={mensaje}' });
  const w = normalizarOpciones({ indice: 'x', contacto: { webhook: '/h', consentimiento: true, privacidad: '/p', formato: 'form' } }).contacto;
  assert.deepEqual(w, { tipo: 'webhook', webhook: '/h', formato: 'form', consentimiento: TEXTOS.consentimiento, privacidad: '/p' });
  assert.equal(normalizarOpciones({ indice: 'x', contacto: { webhook: '/h', consentimiento: 'Acepto.' } }).contacto.consentimiento, 'Acepto.');
  assert.equal(normalizarOpciones({ indice: 'x', contacto: { webhook: '/h' } }).contacto.formato, 'json');
});

test('lee las opciones de los atributos data-*', () => {
  assert.deepEqual(
    opcionesDeAtributos({ indice: '/i.json', titulo: 'T', abierto: '', retardo: '0', contactoEnlace: 'https://wa.me/1?text={mensaje}', sinRespuesta: '/s' }),
    { indice: '/i.json', titulo: 'T', abierto: true, retardo: 0, sinRespuesta: '/s', contacto: { enlace: 'https://wa.me/1?text={mensaje}' } },
  );
  const o = opcionesDeAtributos({ indice: '/i', contactoWebhook: '/h', contactoConsentimiento: 'Sí.' });
  assert.equal(o.contacto.webhook, '/h');
  assert.equal(o.contacto.consentimiento, 'Sí.');
  assert.equal(opcionesDeAtributos({ abierto: 'no' }).abierto, false);
});

test('textos con valores y "¿Te refieres a…?"', () => {
  assert.equal(formatear('Hola {nombre}, {otro}', { nombre: 'Ana' }), 'Hola Ana, {otro}');
  assert.equal(preguntaOpciones(['A']), '¿Te refieres a A?');
  assert.equal(preguntaOpciones(['A', 'B']), '¿Te refieres a A o a B?');
  assert.equal(preguntaOpciones(['A', 'B', 'C']), '¿Te refieres a A, B o a C?');
});

test('el enlace de contacto codifica el mensaje y rechaza esquemas peligrosos', () => {
  assert.equal(enlaceContacto('https://wa.me/569?text={mensaje}', 'Hola & ¿precio?'), 'https://wa.me/569?text=Hola%20%26%20%C2%BFprecio%3F');
  assert.equal(enlaceContacto('mailto:a@b.cl?body={mensaje}', 'x'), 'mailto:a@b.cl?body=x');
  assert.equal(enlaceContacto('/contacto?m={mensaje}', 'x'), '/contacto?m=x');
  assert.equal(enlaceContacto('javascript:alert({mensaje})', 'x'), null);
  assert.equal(enlaceContacto('http://inseguro.cl', 'x'), null);
});

test('el cuerpo del webhook recorta y no lleva la conversación', () => {
  const c = cuerpoContacto({ mensaje: ` ${'a'.repeat(3000)} `, nombre: ' Ana ', email: 'ana@x.cl', ruta: Array.from({ length: 30 }, (_, i) => `n${i}`), pagina: 'https://s/', version: 'v1' });
  assert.equal(c.mensaje.length, 2000);
  assert.equal(c.nombre, 'Ana');
  assert.equal(c.ruta.length, 20);
  assert.equal(c.indice, 'v1');
  assert.deepEqual(Object.keys(c).sort(), ['consentimiento', 'email', 'fecha', 'indice', 'mensaje', 'nombre', 'pagina', 'ruta']);
});

test('valida los campos del formulario', () => {
  assert.deepEqual(erroresContacto({ mensaje: 'Hola', nombre: 'Ana', email: 'ana@x.cl' }), {});
  assert.deepEqual(Object.keys(erroresContacto({ mensaje: ' ', nombre: '', email: 'malo' }, { conConsentimiento: true })), ['mensaje', 'nombre', 'email', 'consentimiento']);
  assert.equal(erroresContacto({ mensaje: 'a', nombre: 'b', email: 'malo' }, {}, { emailInvalido: 'Email raro' }).email, 'Email raro');
});

test('envía el webhook como JSON o como formulario', async () => {
  const llamadas = [];
  const falso = async (url, init) => {
    llamadas.push({ url, init });
    return { ok: url !== '/falla' };
  };
  assert.equal(await enviarContacto('/h', { mensaje: 'm', ruta: ['a', 'b'], consentimiento: null }, { fetch: falso }), true);
  assert.equal(llamadas[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(llamadas[0].init.body), { mensaje: 'm', ruta: ['a', 'b'], consentimiento: null });
  await enviarContacto('/h', { mensaje: 'm', ruta: ['a', 'b'], consentimiento: null }, { formato: 'form', fetch: falso });
  assert.equal(String(llamadas[1].init.body), 'mensaje=m&ruta%5B%5D=a&ruta%5B%5D=b');
  assert.equal(await enviarContacto('/falla', {}, { fetch: falso }), false);
  assert.equal(await enviarContacto('/h', {}, { fetch: async () => { throw new Error('red'); } }), false);
});

test('avisa si el enlace de contacto conserva el número de ejemplo', () => {
  const contacto = (enlace) => normalizarOpciones({ indice: 'x', contacto: { enlace } }).contacto;
  assert.match(avisoContacto(contacto('https://wa.me/TU-NUMERO?text={mensaje}')), /número de ejemplo \(TU-NUMERO\)/);
  assert.match(avisoContacto(contacto('https://wa.me/56900000000?text={mensaje}')), /56900000000/);
  assert.equal(avisoContacto(contacto('https://wa.me/56912345678?text={mensaje}')), null);
  assert.equal(avisoContacto(normalizarOpciones({ indice: 'x', contacto: { webhook: '/h' } }).contacto), null);
  assert.equal(avisoContacto(null), null);
});
