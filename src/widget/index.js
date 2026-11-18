// Punto de entrada del script. Instalación:
//   <script src="pregunta-al-sitio.js" data-indice="/indice.json" defer></script>
// Las opciones también pueden ir en window.PreguntaAlSitioConfig (antes del script), por ejemplo para
// cambiar textos; los atributos data-* del script tienen prioridad.
// Sin data-indice ni PreguntaAlSitioConfig, el script no monta nada: queda PreguntaAlSitio.montar(opciones).
import { montar, registrar, conectarDisparadores, PreguntaAlSitioElemento } from './widget.js';
import { opcionesDeAtributos } from './opciones.js';

const script = document.currentScript;

function iniciar() {
  const opciones = { ...window.PreguntaAlSitioConfig, ...opcionesDeAtributos(script?.dataset ?? {}) };
  if (!opciones.indice) return;
  const existente = document.querySelector('pregunta-al-sitio');
  const elemento = existente ?? montar(opciones);
  conectarDisparadores(elemento);
}

registrar();
window.PreguntaAlSitio = { montar, conectarDisparadores, PreguntaAlSitioElemento };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
else iniciar();
