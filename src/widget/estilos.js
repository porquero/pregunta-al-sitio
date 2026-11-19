// Estilos del widget, dentro del Shadow DOM: no chocan con los del sitio.
// El sitio puede cambiar colores y fuente con variables CSS sobre el elemento:
//   pregunta-al-sitio { --pas-acento: #0a7; --pas-fuente: "Inter", sans-serif; }

export const ESTILOS = `
:host {
  --pas-acento: #2350c4;
  --pas-acento-texto: #ffffff;
  --pas-fondo: #ffffff;
  --pas-texto: #1c2230;
  --pas-texto-suave: #586174;
  --pas-suave: #f1f3f8;
  --pas-borde: #d6dbe6;
  --pas-error: #b3261e;
  --pas-radio: 16px;
  --pas-fuente: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --pas-sombra: 0 12px 40px rgb(16 24 40 / 0.18), 0 2px 6px rgb(16 24 40 / 0.08);
  --pas-z: 2147483000;
  all: initial;
  font-family: var(--pas-fuente);
  color: var(--pas-texto);
}
:host([tema="oscuro"]) {
  --pas-acento: #8fb0ff; --pas-acento-texto: #0b1020; --pas-fondo: #171b24; --pas-texto: #e9edf5;
  --pas-texto-suave: #a5adbd; --pas-suave: #232937; --pas-borde: #343c4d; --pas-error: #ffb4ab;
}
@media (prefers-color-scheme: dark) {
  :host([tema="auto"]) {
    --pas-acento: #8fb0ff; --pas-acento-texto: #0b1020; --pas-fondo: #171b24; --pas-texto: #e9edf5;
    --pas-texto-suave: #a5adbd; --pas-suave: #232937; --pas-borde: #343c4d; --pas-error: #ffb4ab;
  }
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
button, input, textarea { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--pas-acento); outline-offset: 2px; }

.lanzador {
  position: fixed; bottom: 20px; right: 20px; z-index: var(--pas-z);
  display: inline-flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 20px 0 16px;
  border: 0; border-radius: 999px; cursor: pointer;
  background: var(--pas-acento); color: var(--pas-acento-texto); box-shadow: var(--pas-sombra);
  font-size: 15px; font-weight: 600; line-height: 1;
}
.lanzador svg { width: 22px; height: 22px; flex: none; }
.lanzador:focus-visible { outline-color: var(--pas-texto); }
:host([posicion="izquierda"]) .lanzador { right: auto; left: 20px; }

.panel {
  position: fixed; bottom: 88px; right: 20px; z-index: var(--pas-z);
  display: flex; flex-direction: column;
  width: min(400px, calc(100vw - 40px)); height: min(620px, calc(100vh - 120px));
  background: var(--pas-fondo); color: var(--pas-texto);
  border: 1px solid var(--pas-borde); border-radius: var(--pas-radio); box-shadow: var(--pas-sombra);
  overflow: hidden; font-size: 15px; line-height: 1.5;
}
:host([posicion="izquierda"]) .panel { right: auto; left: 20px; }
@media (max-width: 480px) {
  .panel { inset: 0; width: 100%; height: 100%; border-radius: 0; border: 0; }
  :host([abierto]) .lanzador { display: none; }
}

.cabecera { display: flex; align-items: center; gap: 4px; padding: 10px 8px 10px 16px; border-bottom: 1px solid var(--pas-borde); }
.cabecera h2 { flex: 1; margin: 0; font-size: 16px; font-weight: 700; }
.icono {
  display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0;
  border: 0; border-radius: 10px; background: transparent; color: var(--pas-texto-suave); cursor: pointer;
}
.icono:hover { background: var(--pas-suave); color: var(--pas-texto); }
.icono svg { width: 20px; height: 20px; }

.log { position: relative; flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.mensaje--usuario { align-self: flex-end; max-width: 85%; }
.burbuja { margin: 0; padding: 10px 14px; border-radius: 14px 14px 4px 14px; background: var(--pas-acento); color: var(--pas-acento-texto); overflow-wrap: anywhere; }
.mensaje--sitio { max-width: 100%; }
@media (prefers-reduced-motion: no-preference) {
  .mensaje--entra { animation: entrar 220ms ease-out; }
  @keyframes entrar { from { opacity: 0; transform: translateY(6px); } }
}
.escribiendo { display: flex; gap: 5px; padding: 6px 0; }
.escribiendo span { width: 7px; height: 7px; border-radius: 50%; background: var(--pas-texto-suave); opacity: 0.5; }
@media (prefers-reduced-motion: no-preference) {
  .escribiendo span { animation: punto 900ms ease-in-out infinite; }
  .escribiendo span:nth-child(2) { animation-delay: 150ms; }
  .escribiendo span:nth-child(3) { animation-delay: 300ms; }
  @keyframes punto { 50% { opacity: 1; transform: translateY(-3px); } }
}

.pas-respuesta, .bloque { padding: 14px 16px; border-radius: 4px 14px 14px 14px; background: var(--pas-suave); }
.pas-respuesta p, .bloque p { margin: 0 0 8px; }
.pas-antetitulo { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--pas-texto-suave); }
.pas-titulo { margin: 0 0 6px; font-size: 16px; line-height: 1.3; }
/* Enlaces de texto. Los <a class="boton"> (contacto por enlace) conservan el color del botón. */
.pas-respuesta a:not(.boton), .bloque a:not(.boton) { color: var(--pas-acento); text-underline-offset: 2px; }
.pas-items, .pas-pasos { margin: 8px 0; padding-left: 20px; }
.pas-items li, .pas-pasos li { margin: 2px 0; }
.pas-datos { margin: 8px 0; }
.pas-datos div { margin: 6px 0; }
.pas-datos dt { font-weight: 600; }
.pas-datos dd { margin: 0; color: var(--pas-texto-suave); }
.pas-cifras { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; }
.pas-cifra p { margin: 0; }
.pas-cifra__numero { font-size: 22px; font-weight: 700; }
.pas-cifra__etiqueta { font-size: 13px; color: var(--pas-texto-suave); }
.pas-etiquetas { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; padding: 0; list-style: none; }
.pas-etiquetas li { padding: 2px 10px; border: 1px solid var(--pas-borde); border-radius: 999px; font-size: 13px; }
.pas-cta { margin-top: 10px; }
.ver-mas { margin: 12px 0 0; }
.boton--ver-mas { gap: 8px; min-height: 42px; text-align: left; }
.boton--ver-mas .flecha { font-size: 18px; line-height: 1; }
.boton.boton--secundario { border: 1px solid var(--pas-acento); background: var(--pas-fondo); color: var(--pas-acento); }
.boton.boton--secundario:hover { background: var(--pas-acento); color: var(--pas-acento-texto); }
.contacto-plegado { margin-top: 10px; }
.seguir { margin: 14px 0 0; padding-top: 10px; border-top: 1px solid var(--pas-borde); }
.chips-titulo {
  margin: 14px 0 0; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--pas-texto-suave);
}
.chips-titulo + .chips { margin-top: 6px; }
.derivacion { padding-bottom: 8px; border-bottom: 1px solid var(--pas-borde); }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
.chip {
  min-height: 40px; padding: 8px 14px; border: 1px solid var(--pas-acento); border-radius: 999px;
  background: var(--pas-fondo); color: var(--pas-acento); cursor: pointer; text-align: left; line-height: 1.3;
}
.chip:hover { background: var(--pas-acento); color: var(--pas-acento-texto); }

.formulario { display: grid; gap: 10px; margin-top: 10px; }
.formulario label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.campo {
  width: 100%; padding: 10px 12px; border: 1px solid var(--pas-borde); border-radius: 10px;
  background: var(--pas-fondo); color: var(--pas-texto);
}
textarea.campo { resize: vertical; min-height: 80px; }
.campo[aria-invalid="true"] { border-color: var(--pas-error); }
.casilla { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
.casilla input { margin-top: 3px; width: 18px; height: 18px; flex: none; }
.casilla label { font-weight: 400; margin: 0; }
.error { margin: 4px 0 0; font-size: 13px; color: var(--pas-error); }
.error:empty { display: none; }
.boton {
  display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px;
  border: 0; border-radius: 10px; background: var(--pas-acento); color: var(--pas-acento-texto);
  font-weight: 600; text-decoration: none; cursor: pointer;
}
.boton[aria-disabled="true"], .boton:disabled { opacity: 0.6; cursor: default; }
.estado { margin: 0; font-size: 14px; color: var(--pas-texto-suave); }
.confirmacion { margin: 0; font-weight: 600; }

.entrada { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--pas-borde); }
.entrada .campo { flex: 1; border-radius: 999px; padding: 10px 16px; }
.entrada .boton { border-radius: 999px; width: 44px; padding: 0; }
.entrada .boton svg { width: 20px; height: 20px; }
`;
