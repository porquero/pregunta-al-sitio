// Elemento <pregunta-al-sitio>: botón flotante y panel de chat dentro de un Shadow DOM.
// El índice se descarga recién cuando la persona abre el panel (o pasa el puntero por el botón).
//
// API:
//   const w = PreguntaAlSitio.montar({ indice: '/indice.json', ... })  → el elemento
//   w.abrir() · w.cerrar() · w.preguntar(texto) · w.borrar()
// En la página, cualquier elemento con data-pregunta-al-sitio="texto" abre el panel y pregunta ese texto.
import { crearResolver } from '../motor/resolver.js';
import { crearSesion, filtrarEventos, rutaVisitada } from '../motor/sesion.js';
import { crearDialogo } from '../motor/dialogo.js';
import { crearRender } from './render.js';
import { normalizarOpciones, opcionesDeAtributos, avisoContacto } from './opciones.js';
import { ESTILOS, PANTALLA_COMPLETA } from './estilos.js';
import { accionDeClic, esAnclaDeLaPagina } from './acciones.js';

const ICONOS = {
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  cerrar: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  borrar: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  enviar: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

function almacenLocal() {
  try {
    return window.localStorage;
  } catch {
    return null; // Almacenamiento bloqueado: el chat funciona sin guardar la conversación.
  }
}

export class PreguntaAlSitioElemento extends HTMLElement {
  #opciones = null;
  #raiz = null;
  #partes = {};
  #indice = null;
  #resolvedor = null;
  #sesion = null;
  #dialogo = null;
  #render = null;
  #iniciado = false;
  #ultimaConsulta = '';

  /** Opciones dadas por código; si no, se leen de los atributos data-*. */
  configurar(opciones) {
    this.#opciones = normalizarOpciones(opciones);
    return this;
  }

  connectedCallback() {
    if (this.#raiz) return;
    this.#opciones ??= normalizarOpciones(opcionesDeAtributos(this.dataset));
    const o = this.#opciones;
    const aviso = avisoContacto(o.contacto);
    if (aviso) console.warn(`pregunta-al-sitio: ${aviso}`);
    this.setAttribute('posicion', o.posicion);
    this.setAttribute('tema', o.tema);
    this.#raiz = this.attachShadow({ mode: 'open' });
    this.#construir();
    this.#sesion = crearSesion(almacenLocal(), { clave: o.clave });
    if (o.abierto) this.abrir({ enfocar: false });
  }

  #construir() {
    const t = this.#opciones.textos;
    const estilo = document.createElement('style');
    estilo.textContent = ESTILOS;
    const plantilla = document.createElement('template');
    plantilla.innerHTML = `
      <button class="lanzador" type="button" aria-expanded="false" aria-controls="panel">${ICONOS.chat}<span></span></button>
      <section class="panel" id="panel" role="dialog" aria-labelledby="titulo" hidden>
        <header class="cabecera">
          <h2 id="titulo"></h2>
          <button class="icono" type="button" data-accion="borrar">${ICONOS.borrar}<span class="oculto"></span></button>
          <button class="icono" type="button" data-accion="cerrar">${ICONOS.cerrar}<span class="oculto"></span></button>
        </header>
        <div class="log" role="log" aria-live="polite" aria-labelledby="titulo"></div>
        <p class="oculto" role="status" data-estado></p>
        <form class="entrada">
          <label class="oculto" for="campo"></label>
          <input class="campo" id="campo" name="q" type="text" autocomplete="off" maxlength="200" enterkeyhint="send">
          <button class="boton" type="submit">${ICONOS.enviar}<span class="oculto"></span></button>
        </form>
      </section>`;
    this.#raiz.append(estilo, plantilla.content);
    const $ = (s) => this.#raiz.querySelector(s);
    const p = (this.#partes = {
      lanzador: $('.lanzador'),
      panel: $('.panel'),
      log: $('.log'),
      estado: $('[data-estado]'),
      form: $('.entrada'),
      campo: $('#campo'),
    });
    p.lanzador.querySelector('span').textContent = t.boton;
    $('#titulo').textContent = t.titulo;
    $('[data-accion="borrar"] span').textContent = t.borrar;
    $('[data-accion="borrar"]').title = t.borrar;
    $('[data-accion="cerrar"] span').textContent = t.cerrar;
    $('[data-accion="cerrar"]').title = t.cerrar;
    $('label[for="campo"]').textContent = t.campo;
    p.campo.placeholder = t.placeholder;
    $('.entrada .boton span').textContent = t.enviar;

    p.lanzador.addEventListener('click', () => (this.abierto ? this.cerrar() : this.abrir()));
    // Precarga del índice cuando el puntero se acerca al botón.
    p.lanzador.addEventListener('pointerenter', () => this.#cargar().catch(() => {}), { once: true });
    $('[data-accion="cerrar"]').addEventListener('click', () => this.cerrar());
    $('[data-accion="borrar"]').addEventListener('click', () => this.borrar());
    p.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.cerrar();
      }
    });
    p.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const texto = p.campo.value;
      if (!texto.trim()) return p.campo.focus();
      p.campo.value = '';
      this.preguntar(texto);
    });
    p.log.addEventListener('click', (e) => {
      const a = accionDeClic(e.target);
      if (!a) {
        // Un enlace a una sección de esta misma página ("Ver más" en el documento local): con el panel a
        // pantalla completa, el chat taparía la sección, así que se cierra y el navegador va al ancla.
        const ancla = e.target.closest?.('a[href]');
        if (ancla && esAnclaDeLaPagina(ancla.href, location.href) && matchMedia(PANTALLA_COMPLETA).matches) {
          this.cerrar({ enfocar: false });
        }
        return;
      }
      if (a.enlace) e.preventDefault();
      if (a.tipo === 'nodo') this.#dialogo.abrirNodo(a.valor, a.etiqueta);
      else if (a.tipo === 'consulta') this.preguntar(a.valor);
      else this.#dialogo.escribirAlEquipo(a.valor || this.#ultimaConsulta, a.etiqueta);
    });
    // Los enlaces que abren un nodo tienen role="button": como un botón, también responden a Espacio.
    p.log.addEventListener('keydown', (e) => {
      if (e.key !== ' ' || !e.target.matches?.('a[data-nodo]')) return;
      e.preventDefault();
      e.target.click();
    });
  }

  #cargar() {
    this.#indice ??= fetch(this.#opciones.indice).then((r) => {
      if (!r.ok) throw new Error(`indice.json: ${r.status}`);
      return r.json();
    });
    this.#indice.catch(() => {
      this.#indice = null; // Permite reintentar al volver a abrir.
      this.#resolvedor = null;
    });
    return this.#indice;
  }

  #obtenerResolver() {
    this.#resolvedor ??= this.#cargar().then(crearResolver);
    return this.#resolvedor;
  }

  /** Arma el diálogo la primera vez que se abre: bienvenida y conversación guardada. */
  async #iniciar() {
    if (this.#iniciado) return;
    this.#iniciado = true;
    const o = this.#opciones;
    this.#partes.log.replaceChildren(); // Un intento anterior pudo dejar el aviso de error.
    this.#render = crearRender({
      log: this.#partes.log,
      datos: () => this.#cargar(),
      opciones: o,
      ruta: () => rutaVisitada(this.#sesion.cargar()),
    });
    this.#dialogo = crearDialogo({
      obtenerResolver: () => this.#obtenerResolver(),
      render: this.#render,
      sesion: this.#sesion,
      registrarSinRespuesta: (tokens) => {
        if (!o.sinRespuesta) return;
        fetch(o.sinRespuesta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: tokens.slice(0, 12) }),
          keepalive: true,
        }).catch(() => {});
      },
    });
    let indice;
    try {
      indice = await this.#cargar();
    } catch (error) {
      console.error('pregunta-al-sitio:', error);
      this.#render.aviso(o.textos.errorCarga);
      this.#iniciado = false;
      return;
    }
    await this.#bienvenida(indice);
    const ids = new Set(indice.nodos.map((n) => n.id));
    const eventos = filtrarEventos(this.#sesion.cargar(), (id) => ids.has(id));
    for (const e of eventos) if (e.tipo === 'usuario') this.#ultimaConsulta = e.ref;
    await this.#dialogo.restaurar(eventos);
    this.#partes.log.scrollTop = this.#partes.log.scrollHeight;
  }

  /** Bienvenida: el nodo de tipo saludo, si existe; si no, un texto. No se guarda en la sesión. */
  async #bienvenida(indice) {
    const saludo = indice.nodos.find((n) => n.tipo === 'saludo');
    if (saludo) await this.#render.nodo(saludo.id, { animar: false });
    else this.#render.aviso(this.#opciones.textos.bienvenida);
  }

  get abierto() {
    return this.hasAttribute('abierto');
  }

  abrir({ enfocar = true } = {}) {
    const p = this.#partes;
    this.setAttribute('abierto', '');
    p.panel.hidden = false;
    p.lanzador.setAttribute('aria-expanded', 'true');
    if (enfocar) p.campo.focus();
    return this.#iniciar();
  }

  /** Cierra el panel. `enfocar: false` no devuelve el foco al botón (al seguir un ancla, el foco va a la sección). */
  cerrar({ enfocar = true } = {}) {
    const p = this.#partes;
    this.removeAttribute('abierto');
    p.panel.hidden = true;
    p.lanzador.setAttribute('aria-expanded', 'false');
    if (enfocar) p.lanzador.focus();
  }

  async preguntar(texto) {
    if (!this.abierto) await this.abrir();
    else await this.#iniciar();
    this.#ultimaConsulta = String(texto ?? '').trim();
    return this.#dialogo.preguntar(texto);
  }

  async borrar() {
    this.#sesion.borrar();
    this.#render?.vaciar();
    this.#ultimaConsulta = '';
    this.#partes.estado.textContent = this.#opciones.textos.borrada;
    if (this.#iniciado) {
      try {
        await this.#bienvenida(await this.#cargar());
      } catch {
        // Sin índice no hay bienvenida; el próximo intento de abrir lo vuelve a cargar.
      }
    }
    this.#partes.campo.focus();
  }
}

export const NOMBRE_ELEMENTO = 'pregunta-al-sitio';

export function registrar() {
  if (!customElements.get(NOMBRE_ELEMENTO)) customElements.define(NOMBRE_ELEMENTO, PreguntaAlSitioElemento);
}

/** Crea el elemento con estas opciones y lo agrega al final del body. */
export function montar(opciones) {
  registrar();
  const elemento = document.createElement(NOMBRE_ELEMENTO).configurar(opciones);
  document.body.append(elemento);
  return elemento;
}

/** Enlaces y botones de la página con data-pregunta-al-sitio="texto". */
export function conectarDisparadores(elemento) {
  document.addEventListener('click', (e) => {
    const disparador = e.target.closest?.('[data-pregunta-al-sitio]');
    if (!disparador || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const texto = disparador.getAttribute('data-pregunta-al-sitio');
    if (texto) elemento.preguntar(texto);
    else elemento.abrir();
  });
}
