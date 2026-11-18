// Contacto del widget: por enlace (mailto:, WhatsApp u otra URL con {mensaje}) o por webhook.
// El cuerpo del webhook lleva el mensaje, los datos que escribió la persona y la ruta de nodos que vio;
// el resto de la conversación no sale del navegador.

/** URL del enlace de contacto con el mensaje codificado. Solo mailto:, tel:, https: y rutas relativas. */
export function enlaceContacto(plantilla, mensaje = '') {
  const url = String(plantilla ?? '').replace(/\{mensaje\}/g, encodeURIComponent(mensaje));
  return /^(https:\/\/|mailto:|tel:|\/(?!\/))/i.test(url) ? url : null;
}

/** Cuerpo que se envía al webhook. */
export function cuerpoContacto({ mensaje, nombre, email, consentimiento = null, ruta = [], pagina = '', version = null }) {
  return {
    mensaje: String(mensaje ?? '').trim().slice(0, 2000),
    nombre: String(nombre ?? '').trim().slice(0, 120),
    email: String(email ?? '').trim().slice(0, 160),
    consentimiento,
    ruta: Array.isArray(ruta) ? ruta.slice(-20) : [],
    pagina: String(pagina ?? ''),
    indice: version,
    fecha: new Date().toISOString(),
  };
}

/** Errores de validación por campo; objeto vacío si todo está bien. */
export function erroresContacto(datos, { conConsentimiento = false } = {}, textos = {}) {
  const errores = {};
  const requerido = textos.requerido ?? 'Completa este campo.';
  if (!datos.mensaje?.trim()) errores.mensaje = requerido;
  if (!datos.nombre?.trim()) errores.nombre = requerido;
  if (!datos.email?.trim()) errores.email = requerido;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) errores.email = textos.emailInvalido ?? 'Revisa el email.';
  if (conConsentimiento && !datos.consentimiento) errores.consentimiento = requerido;
  return errores;
}

/** Envía el cuerpo al webhook. formato 'form' manda application/x-www-form-urlencoded (sin preflight CORS). */
export async function enviarContacto(url, cuerpo, { formato = 'json', fetch: f = globalThis.fetch } = {}) {
  const init = { method: 'POST' };
  if (formato === 'form') {
    const datos = new URLSearchParams();
    for (const [k, v] of Object.entries(cuerpo)) {
      if (Array.isArray(v)) v.forEach((x) => datos.append(`${k}[]`, x));
      else if (v !== null && v !== undefined) datos.append(k, String(v));
    }
    init.body = datos;
  } else {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(cuerpo);
  }
  try {
    const r = await f(url, init);
    return r.ok;
  } catch {
    return false;
  }
}
