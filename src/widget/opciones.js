// Opciones del widget y textos por defecto. Funciones puras: se prueban en node.
//
// Opciones (todas opcionales salvo indice):
//   indice          URL de indice.json
//   titulo          título del panel y nombre accesible del botón
//   posicion        'derecha' | 'izquierda'
//   tema            'claro' | 'oscuro' | 'auto'
//   abierto         abre el panel al cargar
//   retardo         ms mínimos del indicador de escritura antes de cada respuesta
//   clave           clave de localStorage para la conversación
//   contacto        { enlace } plantilla de URL con {mensaje} (mailto:, https://wa.me/…), o
//                   { webhook, formato: 'json' | 'form', consentimiento, privacidad } formulario que envía a esa URL
//   sinRespuesta    URL que recibe por POST { tokens } de las consultas sin respuesta
//   textos          reemplaza cualquier texto de TEXTOS

import { RETARDO_MS, CLAVE_SESION } from '../motor/config.js';

export const TEXTOS = {
  boton: 'Pregunta al sitio',
  titulo: 'Pregunta al sitio',
  cerrar: 'Cerrar',
  borrar: 'Borrar conversación',
  borrada: 'Conversación borrada.',
  campo: 'Escribe tu pregunta',
  placeholder: 'Escribe tu pregunta…',
  enviar: 'Enviar',
  bienvenida: 'Hola. Pregúntame lo que quieras saber sobre este sitio.',
  cargando: 'Cargando…',
  errorCarga: 'No pudimos cargar las respuestas. Intenta de nuevo en un momento.',
  verMas: 'Ver más sobre {titulo}',
  sigue: 'Sigue preguntando',
  seguirPreguntando: 'Puedes seguir preguntando: escribe otra consulta abajo o elige un tema.',
  opciones: 'Opciones',
  teRefieres: '¿Te refieres a {opciones}?',
  o: 'o a',
  ninguna: 'Ninguna, escribir al equipo',
  mixta: 'Este asistente responde sobre {nombre}. Puedes ver cómo lo trabajamos o dejar tu consulta al equipo.',
  verComo: 'Ver cómo lo trabajan',
  escribirEquipo: 'Escribir al equipo',
  esteSitio: 'este sitio',
  // Contacto
  mensaje: 'Tu mensaje',
  abrirEnlace: 'Enviar mensaje',
  nombre: 'Nombre',
  email: 'Email',
  consentimiento: 'Acepto que usen estos datos para responder mi consulta.',
  privacidad: 'Política de privacidad',
  enviarConsulta: 'Enviar consulta',
  enviando: 'Enviando…',
  enviado: 'Recibimos tu consulta. Te responderemos pronto.',
  errorEnvio: 'No pudimos enviar tu consulta. Intenta de nuevo en un momento.',
  requerido: 'Completa este campo.',
  emailInvalido: 'Revisa el email.',
};

const booleano = (v) => v === true || v === '' || v === 'true' || v === 'si';

/** Lee las opciones desde los atributos data-* del script o del elemento. */
export function opcionesDeAtributos(dataset = {}) {
  const o = {};
  if (dataset.indice) o.indice = dataset.indice;
  if (dataset.titulo) o.titulo = dataset.titulo;
  if (dataset.posicion) o.posicion = dataset.posicion;
  if (dataset.tema) o.tema = dataset.tema;
  if (dataset.abierto !== undefined) o.abierto = booleano(dataset.abierto);
  if (dataset.retardo !== undefined) o.retardo = Number(dataset.retardo);
  if (dataset.clave) o.clave = dataset.clave;
  if (dataset.sinRespuesta) o.sinRespuesta = dataset.sinRespuesta;
  if (dataset.contactoEnlace) o.contacto = { enlace: dataset.contactoEnlace };
  if (dataset.contactoWebhook) {
    o.contacto = {
      webhook: dataset.contactoWebhook,
      formato: dataset.contactoFormato,
      consentimiento: dataset.contactoConsentimiento,
      privacidad: dataset.contactoPrivacidad,
    };
  }
  return o;
}

/** Une las opciones con los valores por defecto. Lanza un Error si falta el índice. */
export function normalizarOpciones(entrada = {}) {
  if (!entrada.indice) throw new Error('pregunta-al-sitio: falta la opción "indice" (URL de indice.json)');
  const titulo = entrada.titulo ?? entrada.textos?.titulo ?? TEXTOS.titulo;
  const textos = { ...TEXTOS, titulo, boton: titulo, ...entrada.textos };
  const c = entrada.contacto ?? {};
  let contacto = null;
  if (c.webhook) {
    contacto = {
      tipo: 'webhook',
      webhook: c.webhook,
      formato: c.formato === 'form' ? 'form' : 'json',
      consentimiento: c.consentimiento ? (c.consentimiento === true ? textos.consentimiento : String(c.consentimiento)) : null,
      privacidad: c.privacidad ?? null,
    };
  } else if (c.enlace) {
    contacto = { tipo: 'enlace', enlace: c.enlace };
  }
  return {
    indice: entrada.indice,
    posicion: entrada.posicion === 'izquierda' ? 'izquierda' : 'derecha',
    tema: ['oscuro', 'auto'].includes(entrada.tema) ? entrada.tema : 'claro',
    abierto: Boolean(entrada.abierto),
    retardo: Number.isFinite(entrada.retardo) && entrada.retardo >= 0 ? entrada.retardo : RETARDO_MS,
    clave: entrada.clave ?? CLAVE_SESION,
    sinRespuesta: entrada.sinRespuesta ?? null,
    contacto,
    textos,
  };
}

/** Reemplaza {nombre} en un texto. */
/** Marcadores del número de ejemplo de la documentación: si siguen en el enlace, no se cambió. */
export const MARCADORES_CONTACTO = ['TU-NUMERO', '56900000000'];

/** Aviso para la consola si el enlace de contacto aún tiene el número de ejemplo; si no, null. */
export function avisoContacto(contacto) {
  if (contacto?.tipo !== 'enlace') return null;
  const marcador = MARCADORES_CONTACTO.find((m) => contacto.enlace.includes(m));
  return marcador ? `el enlace de contacto aún tiene el número de ejemplo (${marcador}); cambia data-contacto-enlace` : null;
}

export function formatear(texto, valores = {}) {
  return String(texto).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(valores, k) ? String(valores[k]) : m));
}

/** "¿Te refieres a A o a B?" con los nombres de las opciones. */
export function preguntaOpciones(nombres, textos = TEXTOS) {
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} ${textos.o} ${nombres.at(-1)}` : nombres[0];
  return formatear(textos.teRefieres, { opciones: lista });
}
