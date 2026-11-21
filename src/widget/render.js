// Dibuja la conversación en el registro (role="log"): un bloque por evento, con un retardo breve e
// indicador de escritura antes de cada respuesta. El texto del visitante se inserta como texto, nunca
// como HTML; el HTML de las respuestas viene del índice, armado y escapado por `build`.
import { formatear, preguntaOpciones } from './opciones.js';
import { enlaceContacto, cuerpoContacto, erroresContacto, enviarContacto } from './contacto.js';
import { chipsSeguimiento, sugerenciasSinRespuesta } from '../motor/dialogo.js';
import { pesoTipo } from '../motor/resolver.js';

const datosChip = (s) => ({ texto: s.texto, datos: s.nodo ? { nodo: s.nodo } : { q: s.q } });

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** Lista de chips. Con titulo, la etiqueta también se ve sobre los chips (los separa del "Ver más"). */
function chips(etiqueta, lista, { titulo = false } = {}) {
  const ul = el('ul', 'chips');
  ul.setAttribute('aria-label', etiqueta);
  llenar(ul, lista);
  if (!titulo) return ul;
  const caja = document.createDocumentFragment();
  const t = el('p', 'chips-titulo', etiqueta);
  t.setAttribute('aria-hidden', 'true');
  caja.append(t, ul);
  return caja;
}

function llenar(ul, lista) {
  for (const { texto, datos } of lista) {
    const li = el('li');
    const b = el('button', 'chip', texto);
    b.type = 'button';
    Object.assign(b.dataset, datos);
    li.append(b);
    ul.append(li);
  }
}

/**
 *   log        contenedor role="log", con scroll propio
 *   datos      () => Promise<indice>
 *   opciones   opciones normalizadas del widget
 *   ruta       () => ids de nodos vistos, para el contacto
 */
export function crearRender({ log, datos, opciones, ruta = () => [] }) {
  const { textos, retardo, contacto } = opciones;
  const reducido = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let inicioIntercambio = null;
  let contador = 0;

  const nodoDe = async (id) => (await datos()).nodos.find((n) => n.id === id) ?? null;
  let mapa = null;
  const porId = async () => (mapa ??= new Map((await datos()).nodos.map((n) => [n.id, n])));
  // Peso del tipo de cada nodo (config.tipos): desempata los chips, la oferta antes que el contenido.
  const prioridadDe = async () => {
    const indice = await datos();
    const m = await porId();
    return (id) => pesoTipo(indice.config?.tipos, m.get(id)?.tipo);
  };
  const titulo = async (id) => {
    const n = await nodoDe(id);
    return n ? n.titulo.split(',')[0].trim() : id;
  };

  async function responder(construir, { animar }) {
    let indicador = null;
    let minimo = null;
    if (animar && retardo > 0) {
      indicador = el('div', 'escribiendo');
      indicador.setAttribute('aria-hidden', 'true');
      indicador.append(el('span'), el('span'), el('span'));
      log.append(indicador);
      log.scrollTop = log.scrollHeight;
      minimo = espera(retardo);
    }
    let contenido = null;
    try {
      [contenido] = await Promise.all([construir(), minimo]);
    } finally {
      indicador?.remove();
    }
    if (!contenido) return null;
    const mensaje = el('div', 'mensaje mensaje--sitio');
    if (animar && !reducido) mensaje.classList.add('mensaje--entra');
    mensaje.append(contenido);
    log.append(mensaje);
    anclar(mensaje);
    return mensaje;
  }

  /** Si la respuesta no cabe, deja arriba el mensaje del visitante para leerla desde el inicio. */
  function anclar(mensaje) {
    const alto = log.clientHeight;
    const inicio = inicioIntercambio && inicioIntercambio.isConnected ? inicioIntercambio : mensaje;
    const fin = mensaje.offsetTop + mensaje.offsetHeight;
    if (fin - inicio.offsetTop + 16 > alto) log.scrollTop = inicio.offsetTop - 16;
    else log.scrollTop = log.scrollHeight;
  }

  /**
   * Bloque del nodo: su HTML, "Ver más" y los chips de seguimiento. "Ver más" es un botón con el nombre del
   * tema: es el siguiente paso más directo y no debe confundirse con los chips de otros temas.
   */
  async function bloqueNodo(id, { conSeguimiento = true, conVerMas = true, vistos = [] } = {}) {
    const n = await nodoDe(id);
    if (!n) return null;
    const plantilla = document.createElement('template');
    plantilla.innerHTML = n.respuesta ?? '';
    const bloque = plantilla.content.firstElementChild ?? el('div', 'bloque', n.titulo);
    if (n.enlace && conVerMas) {
      const p = el('p', 'ver-mas');
      const nombre = n.titulo.split(',')[0].trim();
      const a = el('a', 'boton boton--ver-mas', formatear(textos.verMas, { titulo: nombre }));
      a.href = n.enlace;
      if (/^https?:/i.test(n.enlace) && new URL(n.enlace, location.href).origin !== location.origin) a.rel = 'noopener';
      if (!textos.verMas.includes('{titulo}')) a.append(el('span', 'oculto', `: ${n.titulo}`));
      const flecha = el('span', 'flecha', '→');
      flecha.setAttribute('aria-hidden', 'true');
      a.append(flecha);
      p.append(a);
      bloque.append(p);
    }
    const seguimiento = conSeguimiento ? chipsSeguimiento(n, { vistos, porId: await porId(), prioridad: await prioridadDe() }) : [];
    if (seguimiento.length) {
      bloque.append(chips(textos.sigue, seguimiento.map(datosChip), { titulo: Boolean(n.enlace) }));
    }
    return bloque;
  }

  /**
   * Formulario plegado tras un botón: cuando la consulta no tuvo respuesta, el contacto es una opción y no
   * el final de la conversación.
   */
  function plegado(etiqueta, crear) {
    const caja = el('div', 'contacto-plegado');
    const boton = el('button', 'boton boton--secundario', etiqueta);
    boton.type = 'button';
    boton.addEventListener('click', () => {
      const form = crear();
      caja.replaceChildren(form);
      form.querySelector('textarea, input')?.focus();
    });
    caja.append(boton);
    return caja;
  }

  function campo(form, { nombre, etiqueta, tipo = 'input', atributos = {} }) {
    contador += 1;
    const id = `pas-${nombre}-${contador}`;
    const envoltura = el('div');
    const label = el('label', null, etiqueta);
    label.htmlFor = id;
    const control = el(tipo, 'campo');
    control.id = id;
    control.name = nombre;
    for (const [k, v] of Object.entries(atributos)) control.setAttribute(k, v);
    const error = el('p', 'error');
    error.id = `${id}-error`;
    error.dataset.error = nombre;
    control.setAttribute('aria-describedby', error.id);
    envoltura.append(label, control, error);
    form.append(envoltura);
    return control;
  }

  /** Contacto por enlace: el mensaje editable y un botón que abre el enlace con el mensaje. */
  function contactoEnlace(texto) {
    const form = el('form', 'formulario');
    const mensaje = campo(form, { nombre: 'mensaje', etiqueta: textos.mensaje, tipo: 'textarea', atributos: { rows: '3', maxlength: '2000' } });
    mensaje.value = texto ?? '';
    const a = el('a', 'boton', textos.abrirEnlace);
    a.target = '_blank';
    a.rel = 'noopener';
    const actualizar = () => {
      const url = enlaceContacto(contacto.enlace, mensaje.value);
      if (url) a.href = url;
    };
    mensaje.addEventListener('input', actualizar);
    actualizar();
    form.addEventListener('submit', (e) => e.preventDefault());
    form.append(a);
    return form;
  }

  /** Contacto por webhook: formulario que envía el mensaje, nombre y email. */
  function contactoWebhook(texto) {
    const form = el('form', 'formulario');
    form.noValidate = true;
    const mensaje = campo(form, { nombre: 'mensaje', etiqueta: textos.mensaje, tipo: 'textarea', atributos: { rows: '3', maxlength: '2000', required: '' } });
    mensaje.value = texto ?? '';
    campo(form, { nombre: 'nombre', etiqueta: textos.nombre, atributos: { autocomplete: 'name', maxlength: '120', required: '' } });
    campo(form, { nombre: 'email', etiqueta: textos.email, atributos: { type: 'email', autocomplete: 'email', maxlength: '160', required: '' } });
    // Trampa para bots: campo oculto que una persona no completa.
    const trampa = el('input');
    trampa.name = 'sitio_web';
    trampa.tabIndex = -1;
    trampa.autocomplete = 'off';
    trampa.className = 'oculto';
    trampa.setAttribute('aria-hidden', 'true');
    form.append(trampa);
    if (contacto.consentimiento) {
      contador += 1;
      const caja = el('div', 'casilla');
      const check = el('input');
      check.type = 'checkbox';
      check.name = 'consentimiento';
      check.id = `pas-consentimiento-${contador}`;
      const label = el('label', null, `${contacto.consentimiento} `);
      label.htmlFor = check.id;
      if (contacto.privacidad) {
        const a = el('a', null, textos.privacidad);
        a.href = contacto.privacidad;
        a.target = '_blank';
        a.rel = 'noopener';
        label.append(a);
      }
      const error = el('p', 'error');
      error.id = `${check.id}-error`;
      error.dataset.error = 'consentimiento';
      check.setAttribute('aria-describedby', error.id);
      caja.append(check, label);
      form.append(caja, error);
    }
    const acciones = el('div');
    const boton = el('button', 'boton', textos.enviarConsulta);
    boton.type = 'submit';
    const estado = el('p', 'estado');
    estado.setAttribute('role', 'status');
    acciones.append(boton, estado);
    form.append(acciones);

    form.addEventListener('input', (e) => {
      const nombre = e.target.name;
      const error = form.querySelector(`[data-error="${nombre}"]`);
      if (error) error.textContent = '';
      e.target.removeAttribute?.('aria-invalid');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.dataset.enviando) return;
      const f = form.elements;
      const valores = {
        mensaje: f.mensaje.value,
        nombre: f.nombre.value,
        email: f.email.value,
        consentimiento: f.consentimiento ? (f.consentimiento.checked ? contacto.consentimiento : null) : null,
      };
      const errores = erroresContacto(valores, { conConsentimiento: Boolean(contacto.consentimiento) }, textos);
      for (const error of form.querySelectorAll('[data-error]')) {
        const nombre = error.dataset.error;
        error.textContent = errores[nombre] ?? '';
        if (errores[nombre]) f[nombre].setAttribute('aria-invalid', 'true');
        else f[nombre].removeAttribute('aria-invalid');
      }
      const primero = Object.keys(errores)[0];
      if (primero) return f[primero].focus();
      if (trampa.value) return; // bot
      form.dataset.enviando = 'si';
      boton.disabled = true;
      estado.textContent = textos.enviando;
      const indice = await datos();
      const ok = await enviarContacto(
        contacto.webhook,
        cuerpoContacto({ ...valores, ruta: ruta(), pagina: location.href, version: indice.version }),
        { formato: contacto.formato },
      );
      delete form.dataset.enviando;
      boton.disabled = false;
      if (!ok) {
        estado.textContent = textos.errorEnvio;
        return;
      }
      const confirmacion = el('p', 'confirmacion', textos.enviado);
      confirmacion.setAttribute('role', 'status');
      confirmacion.tabIndex = -1;
      form.replaceWith(confirmacion);
      confirmacion.focus({ preventScroll: true });
    });
    return form;
  }

  return {
    usuario(texto) {
      const mensaje = el('div', 'mensaje mensaje--usuario');
      mensaje.append(el('p', 'burbuja', texto));
      log.append(mensaje);
      inicioIntercambio = mensaje;
      log.scrollTop = log.scrollHeight;
      return mensaje;
    },

    nodo(id, op) {
      return responder(() => bloqueNodo(id, { vistos: op?.vistos ?? [] }), op);
    },

    opciones(ids, op) {
      return responder(async () => {
        const nombres = await Promise.all(ids.map(titulo));
        const bloque = el('div', 'bloque');
        bloque.append(el('p', null, preguntaOpciones(nombres, textos)));
        bloque.append(chips(textos.opciones, [
          ...ids.map((id, i) => ({ texto: nombres[i], datos: { nodo: id } })),
          { texto: textos.ninguna, datos: { equipo: '' } },
        ]));
        return bloque;
      }, op);
    },

    mixta({ nodo, texto }, op) {
      return responder(async () => {
        const indice = await datos();
        const bloque = el('div', 'bloque');
        bloque.append(el('p', null, formatear(textos.mixta, { nombre: indice.nombre ?? textos.esteSitio })));
        bloque.append(chips(textos.opciones, [
          { texto: textos.verComo, datos: { nodo } },
          { texto: textos.escribirEquipo, datos: { equipo: texto } },
        ]));
        return bloque;
      }, op);
    },

    contacto({ texto, derivado }, op) {
      return responder(async () => {
        const indice = await datos();
        const bloque = (await bloqueNodo('contacto', { conSeguimiento: false, conVerMas: !contacto })) ?? el('div', 'bloque');
        if (derivado && indice.derivacion) bloque.prepend(el('p', 'derivacion', indice.derivacion));
        const crear = contacto?.tipo === 'enlace' ? () => contactoEnlace(texto)
          : contacto?.tipo === 'webhook' ? () => contactoWebhook(texto) : null;
        if (!derivado) {
          if (crear) bloque.append(crear());
          return bloque;
        }
        // Sin respuesta: el formulario queda plegado y se invita a seguir con otros temas.
        if (crear) bloque.append(plegado(textos.escribirEquipo, crear));
        bloque.append(el('p', 'seguir', textos.seguirPreguntando));
        const temas = sugerenciasSinRespuesta(indice.nodos, { vistos: op?.vistos ?? [], prioridad: await prioridadDe() });
        if (temas.length) bloque.append(chips(textos.sigue, temas.map(datosChip)));
        return bloque;
      }, op);
    },

    /** Mensaje del sitio sin nodo (bienvenida, error de carga). */
    aviso(texto, { chipsInicio = [] } = {}) {
      const mensaje = el('div', 'mensaje mensaje--sitio');
      const bloque = el('div', 'bloque');
      bloque.append(el('p', null, texto));
      if (chipsInicio.length) bloque.append(chips(textos.sigue, chipsInicio));
      mensaje.append(bloque);
      log.append(mensaje);
      return mensaje;
    },

    vaciar() {
      log.replaceChildren();
      inicioIntercambio = null;
    },
  };
}
