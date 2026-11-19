// validar: revisa los nodos de un sitio antes de publicar.
// Errores: bloquean la publicación. Avisos: se revisan, pero no bloquean.
//
// Las reglas de estructura son fijas (ids, estados, destinos de chips y aristas). Las de estilo se
// configuran en sitio.yaml, clave "validar"; lo que falte toma los valores de VALIDAR_D:
//   respuesta   { palabras_min, palabras_max, nombrar, nombrar_salvo }  largo de la respuesta corta y
//               un nombre que debería aparecer en ella (aviso), salvo en los tipos indicados
//   preguntas   { min, max }                 mínimo (error) y máximo recomendado (aviso)
//   tipos       lista de tipos permitidos; vacía acepta cualquiera
//   variantes   lista de variantes de tarjeta permitidas; vacía acepta cualquiera
//   aristas     { tipos, peso_min, peso_max }
//   faq_max     máximo recomendado de preguntas frecuentes (aviso)
//   pendiente   marca de texto por redactar: error en un nodo aprobado, aviso en un borrador
//   reglas      [{ patron, mensaje, nivel: error|aviso, campo: todo|respuesta|respuesta_y_cuerpo, sensible }]
//               expresiones regulares propias del sitio; sin "sensible" no distinguen mayúsculas
import { leerSitio, leerNodos, ESTADOS, FORMATOS } from './contenido/leer.mjs';
import { idsEnlazados, textoVisible } from './contenido/html.mjs';

export const VALIDAR_D = {
  respuesta: { palabras_min: 40, palabras_max: 60, nombrar: null, nombrar_salvo: ['saludo'] },
  preguntas: { min: 6, max: 12 },
  tipos: [],
  variantes: [],
  aristas: { tipos: ['prueba', 'proceso', 'profundiza', 'cta'], peso_min: 0.3, peso_max: 1 },
  faq_max: 6,
  pendiente: '[REDACTAR',
  reglas: [],
};

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const contarPalabras = (texto) => String(texto ?? '').trim().split(/\s+/u).filter(Boolean).length;

/** Une la configuración del sitio con los valores por defecto. */
export function reglasDe(sitio = {}) {
  const v = sitio.validar ?? {};
  return {
    ...VALIDAR_D,
    ...v,
    respuesta: { ...VALIDAR_D.respuesta, ...v.respuesta },
    preguntas: { ...VALIDAR_D.preguntas, ...v.preguntas },
    aristas: { ...VALIDAR_D.aristas, ...v.aristas },
  };
}

/** Valida nodos ya leídos. Devuelve { errores, avisos } como listas de "id: mensaje". */
export function validarNodos(nodos, sitio = {}, erroresLectura = []) {
  const r = reglasDe(sitio);
  const errores = [...erroresLectura];
  const avisos = [];
  const reglas = (r.reglas ?? []).map((x) => {
    try {
      return { ...x, re: new RegExp(x.patron, x.sensible ? 'u' : 'iu') };
    } catch (e) {
      errores.push(`sitio.yaml: regla con patrón inválido "${x.patron}": ${e.message}`);
      return null;
    }
  }).filter(Boolean);

  const porId = new Map();
  for (const n of nodos) {
    if (n.archivo && n.archivo !== `${n.id}.md`) avisos.push(`${n.id}: el archivo se llama ${n.archivo}`);
    if (porId.has(n.id)) {
      errores.push(`${n.id}: id duplicado (${porId.get(n.id).archivo} y ${n.archivo})`);
      continue;
    }
    porId.set(n.id, n);
  }
  if (sitio.autoenlazar_destino != null && !['enlace', 'nodo'].includes(sitio.autoenlazar_destino)) {
    errores.push(`sitio.yaml: autoenlazar_destino '${sitio.autoenlazar_destino}' inválido (enlace, nodo)`);
  }
  if (!porId.has('contacto')) avisos.push('sitio: no hay un nodo con id "contacto" (destino de las consultas sin respuesta)');

  for (const n of porId.values()) {
    const e = (m) => errores.push(`${n.id}: ${m}`);
    const a = (m) => avisos.push(`${n.id}: ${m}`);

    if (!ID.test(n.id)) e('id inválido (solo minúsculas, números y guiones)');
    if (!ESTADOS.includes(n.estado)) e(`estado '${n.estado}' inválido (${ESTADOS.join(', ')})`);
    if (r.tipos.length && !r.tipos.includes(n.tipo)) e(`tipo '${n.tipo}' inválido`);
    if (!FORMATOS.includes(n.formato)) e(`formato '${n.formato}' inválido (${FORMATOS.join(', ')})`);
    if (n.formato === 'tarjeta' && r.variantes.length && !r.variantes.includes(n.variante)) e('formato tarjeta sin variante válida');

    // Solo cuenta el texto visible: de [texto](url) cuenta "texto".
    const palabras = contarPalabras(textoVisible(n.respuestaCorta));
    const { palabras_min: min, palabras_max: max, nombrar, nombrar_salvo: salvo } = r.respuesta;
    if (palabras < min || palabras > max) e(`respuesta_corta tiene ${palabras} palabras (${min} a ${max})`);
    if (nombrar && !(salvo ?? []).includes(n.tipo) && !n.respuestaCorta.includes(nombrar)) a(`respuesta_corta no nombra a ${nombrar}`);

    if (n.preguntas.length < r.preguntas.min) e(`tiene ${n.preguntas.length} preguntas (mínimo ${r.preguntas.min})`);
    else if (n.preguntas.length > r.preguntas.max) a(`tiene ${n.preguntas.length} preguntas (se recomiendan hasta ${r.preguntas.max})`);

    if (n.enlace && !/^(https:\/\/|\/(?!\/)|#|mailto:|tel:)/.test(n.enlace)) e(`enlace '${n.enlace}' debe ser https o una ruta que empiece con /`);

    // Chips: con destino "a", el destino debe existir y mostrarse en el chat.
    for (const chip of n.chips) {
      if (!chip.texto) e('chip sin texto');
      if (!chip.a) continue;
      const destino = porId.get(chip.a);
      if (!destino) e(`chip '${chip.texto}' hacia '${chip.a}', que no existe`);
      else if (chip.a === n.id) e(`chip '${chip.texto}' hacia sí mismo`);
      else if (!destino.enChat) e(`chip '${chip.texto}' hacia '${chip.a}', que no está en el chat`);
    }

    // Enlaces [texto](nodo:id) de la respuesta corta.
    for (const id of idsEnlazados(n.respuestaCorta)) {
      const destino = porId.get(id);
      if (!destino) e(`enlace hacia '${id}', que no existe`);
      else if (id === n.id) e('enlace hacia sí mismo');
      else if (!destino.enChat) e(`enlace hacia '${id}', que no está en el chat`);
    }

    for (const arista of n.aristas) {
      if (!porId.has(arista.a)) e(`arista hacia '${arista.a}', que no existe`);
      else if (arista.a === n.id) e('arista hacia sí mismo');
      if (r.aristas.tipos.length && !r.aristas.tipos.includes(arista.tipo)) e(`arista con tipo '${arista.tipo}' inválido`);
      if (!(arista.peso >= r.aristas.peso_min && arista.peso <= r.aristas.peso_max)) {
        e(`arista hacia '${arista.a}' con peso ${arista.peso} (${r.aristas.peso_min} a ${r.aristas.peso_max})`);
      }
    }

    n.faq.forEach((p, i) => {
      if (!p || typeof p !== 'object' || !p.pregunta || !p.respuesta) e(`faq #${i + 1} sin pregunta o respuesta`);
    });
    if (n.faq.length > r.faq_max) a(`más de ${r.faq_max} preguntas frecuentes`);

    // Textos para las reglas de redacción.
    const textos = {
      respuesta: n.respuestaCorta,
      respuesta_y_cuerpo: `${n.respuestaCorta} ${n.cuerpo}`,
      todo: `${n.respuestaCorta}\n${n.cuerpo}\n${JSON.stringify([n.tarjeta, n.faq])}`,
    };
    if (r.pendiente) {
      const pendientes = textos.todo.split(r.pendiente).length - 1;
      if (pendientes > 0) {
        if (n.estado === 'aprobado') e(`aprobado con ${pendientes} ${r.pendiente}]`);
        else a(`${pendientes} ${r.pendiente}] pendiente(s)`);
      }
    }
    for (const regla of reglas) {
      if (regla.re.test(textos[regla.campo ?? 'todo'] ?? textos.todo)) (regla.nivel === 'aviso' ? a : e)(regla.mensaje ?? `coincide con /${regla.patron}/`);
    }
  }
  return { errores, avisos };
}

/** Lee y valida la carpeta de un sitio. */
export function validarSitio(dir) {
  const sitio = leerSitio(dir);
  const { nodos, errores } = leerNodos(dir);
  return { ...validarNodos(nodos, sitio, errores), nodos };
}
