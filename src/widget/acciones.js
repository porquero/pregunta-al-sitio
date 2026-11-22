// Qué hace un clic dentro del registro del chat. Sin DOM propio para poder probarlo en Node.
//   button[data-nodo] y a[data-nodo]  abren ese nodo (los a vienen de [texto](nodo:id) y del autoenlace)
//   button[data-q]                    consulta su texto al motor
//   button[data-equipo]               escribe al equipo
export const SELECTOR_ACCION = 'button[data-nodo], a[data-nodo], button[data-q], button[data-equipo]';

/**
 * ¿El enlace lleva a una sección de la misma página (mismo documento, con #fragmento)? Así son "Ver más"
 * y los enlaces del documento local (sitio: localhost). `href` es el href resuelto del <a>.
 */
export function esAnclaDeLaPagina(href, ubicacion) {
  let u;
  let aqui;
  try {
    u = new URL(href, ubicacion);
    aqui = new URL(ubicacion);
  } catch {
    return false;
  }
  return u.hash.length > 1 && u.origin === aqui.origin && u.pathname === aqui.pathname && u.search === aqui.search;
}

/** Elemento clicado → { tipo: 'nodo' | 'consulta' | 'equipo', valor, etiqueta, enlace } o null. */
export function accionDeClic(objetivo) {
  const el = objetivo?.closest?.(SELECTOR_ACCION);
  if (!el) return null;
  const etiqueta = el.textContent.trim();
  // enlace: un <a>, cuyo clic hay que cancelar para no navegar a "#".
  const enlace = el.tagName === 'A';
  const d = el.dataset;
  if (d.nodo) return { tipo: 'nodo', valor: d.nodo, etiqueta, enlace };
  if (d.q !== undefined) return { tipo: 'consulta', valor: d.q, etiqueta, enlace };
  return { tipo: 'equipo', valor: d.equipo, etiqueta, enlace };
}
