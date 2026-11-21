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
import { leerSitio, leerNodos, nombresEnlazables, ESTADOS, FORMATOS } from './contenido/leer.mjs';
import { idsEnlazados, textoVisible, ENLACE_MD, crearFiltroUrl, dominiosDe, dominioFrecuente, plegar } from './contenido/html.mjs';
import { STOPWORDS, crearTerminos, normalizar, prepararDiccionario } from '../src/motor/normalizar.js';
import { PESO_TIPO_MIN, PESO_TIPO_MAX } from '../src/motor/config.js';

/** Claves admitidas en los objetos de una tarjeta. */
export const CLAVES_TARJETA = { items: ['titulo', 'texto', 'ruta'], cifras: ['numero', 'etiqueta'], cta: ['texto', 'destino'] };
const ENTRECOMILLAR = 'si un valor lleva coma o dos puntos, entrecomíllalo: { titulo: A, texto: "2,5 horas" } (sin comillas se lee como texto "2" y una clave "5 horas")';

/** Problemas de un objeto de tarjeta: claves desconocidas y valores nulos. */
function clavesMal(objeto, admitidas) {
  const problemas = [];
  for (const [k, v] of Object.entries(objeto)) {
    if (!admitidas.includes(k)) problemas.push(`clave '${k}' desconocida`);
    else if (v === null || v === undefined) problemas.push(`'${k}' sin valor`);
  }
  return problemas;
}

const escaparRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cantidad de textos que mencionan el nombre como palabra completa, sin tildes ni mayúsculas. */
function menciones(nombre, textos) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaparRe(plegar(nombre.trim()))}(?![\\p{L}\\p{N}])`, 'u');
  return textos.filter((x) => re.test(plegar(x))).length;
}

/** Umbrales de los avisos de aristas y nombres enlazables. */
export const LIMITES = { concentracion: 0.15, mencionesNombre: 10, comunNombre: 3, repeticionPreguntas: 0.6 };

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
  let dominios = dominiosDe(sitio.sitio);
  if (!dominios.length) {
    // Igual que build: sin sitio, el dominio más frecuente en los enlace.
    const inferido = dominioFrecuente(nodos.map((n) => n.enlace));
    if (inferido) {
      avisos.push(`sitio.yaml: falta sitio (dominio principal); build usará ${inferido}, el más frecuente en los enlace. Escríbelo.`);
      dominios = [inferido];
    }
  }
  if (String(sitio.sitio ?? '').includes(r.pendiente)) avisos.push('sitio.yaml: completa sitio con el dominio principal (misitio.cl)');
  const filtroUrl = crearFiltroUrl(dominios);
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

    // Enlaces fuera del sitio principal: build los omite (queda el texto, sin "Ver más" ni botón).
    const urls = [
      ...[...n.respuestaCorta.matchAll(ENLACE_MD)].map((m) => m[2]).filter((u) => !u.startsWith('nodo:')),
      n.enlace,
      n.tarjeta?.cta?.destino,
      ...(Array.isArray(n.tarjeta?.items) ? n.tarjeta.items.map((i) => i?.ruta) : []),
    ].filter(Boolean);
    for (const u of urls) {
      if (!filtroUrl(u)) a(`enlace '${u}' fuera del sitio (${dominios.length ? dominios.join(', ') : 'falta sitio en sitio.yaml'}): se omite`);
    }

    // Tarjeta: solo claves conocidas y sin valores nulos (un YAML sin comillas parte "2,5 horas").
    const t = n.tarjeta ?? {};
    for (const campo of ['items', 'cifras']) {
      if (!Array.isArray(t[campo])) continue;
      t[campo].forEach((x, i) => {
        if (!x || typeof x !== 'object') return;
        const p = clavesMal(x, CLAVES_TARJETA[campo]);
        if (p.length) e(`tarjeta.${campo}[${i}]: ${p.join(', ')} (se esperan ${CLAVES_TARJETA[campo].join(', ')}); ${ENTRECOMILLAR}`);
      });
    }
    if (t.cta && typeof t.cta === 'object') {
      const p = clavesMal(t.cta, CLAVES_TARJETA.cta);
      if (p.length) e(`tarjeta.cta: ${p.join(', ')} (se esperan ${CLAVES_TARJETA.cta.join(', ')}); ${ENTRECOMILLAR}`);
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
  avisos.push(...avisosGrafo([...porId.values()]), ...avisosAutoenlace([...porId.values()], sitio, filtroUrl));
  const tipos = revisarTipos(sitio.config?.tipos, [...porId.values()]);
  errores.push(...tipos.errores);
  avisos.push(...tipos.avisos, ...avisosRepeticion([...porId.values()], sitio.diccionario), ...avisosAmbito(sitio));
  return { errores, avisos };
}

/**
 * Aristas que empobrecen los chips: recíprocas (A ofrece B y B ofrece A), una sola saliente y nodos que
 * reciben aristas de más del 15 % de los nodos (aparecerían en casi todas las respuestas). contacto queda
 * fuera de este último: recibir llamados a la acción de muchos nodos es su función.
 */
export function avisosGrafo(nodos) {
  const enChat = nodos.filter((n) => n.enChat);
  const ids = new Set(enChat.map((n) => n.id));
  const salientes = new Map(enChat.map((n) => [n.id, new Set(n.aristas.map((a) => a.a).filter((a) => ids.has(a) && a !== n.id))]));
  const avisos = [];
  for (const [id, destinos] of salientes) {
    for (const d of destinos) if (id < d && salientes.get(d)?.has(id)) avisos.push(`${id}: arista recíproca con '${d}' (cada uno ofrece al otro y los chips rebotan)`);
    if (destinos.size === 1) avisos.push(`${id}: una sola arista saliente (con dos o más los chips varían)`);
  }
  const limite = LIMITES.concentracion * enChat.length;
  const entrantes = new Map();
  for (const destinos of salientes.values()) for (const d of destinos) entrantes.set(d, (entrantes.get(d) ?? 0) + 1);
  for (const [id, k] of entrantes) {
    if (id !== 'contacto' && k > limite) avisos.push(`${id}: recibe aristas de ${k} de ${enChat.length} nodos (más del 15 %); se ofrecerá como chip en muchas respuestas`);
  }
  return avisos;
}

/**
 * Con autoenlazar: nombres enlazables que enlazarían de más (una palabra común o mencionada en las
 * respuestas de más de 10 nodos) y, con autoenlazar_destino: enlace, nodos sin enlace del sitio.
 * Una palabra es común si es una palabra vacía o aparece en las respuestas de 3 o más nodos.
 */
export function avisosAutoenlace(nodos, sitio, filtroUrl) {
  if (!sitio.autoenlazar) return [];
  const enChat = nodos.filter((n) => n.enChat && n.autoenlazar !== false);
  const avisos = [];
  for (const n of enChat) {
    const nombres = nombresEnlazables(n);
    const otras = nodos.filter((x) => x.id !== n.id && x.enChat).map((x) => textoVisible(x.respuestaCorta));
    for (const nombre of nombres) {
      const k = menciones(nombre, otras);
      const unaPalabra = !/\s/.test(nombre.trim());
      if (k > LIMITES.mencionesNombre) {
        avisos.push(`${n.id}: el nombre enlazable '${nombre}' aparece en las respuestas de ${k} nodos; cambia el título, quita el alias o usa autoenlazar: false`);
      } else if (unaPalabra && (STOPWORDS.has(plegar(nombre.trim())) || k >= LIMITES.comunNombre)) {
        avisos.push(`${n.id}: el nombre enlazable '${nombre}' es una palabra común (${k} respuestas la usan); cambia el título, quita el alias o usa autoenlazar: false`);
      }
    }
    if (sitio.autoenlazar_destino === 'enlace' && nombres.length && !filtroUrl(n.enlace)) {
      avisos.push(`${n.id}: sin enlace del sitio; con autoenlazar_destino: enlace, sus menciones quedan como texto`);
    }
  }
  return avisos;
}

/**
 * config.tipos: { tipo: { peso, respaldo } }. Errores: clave desconocida, peso fuera de 0 a 1,5 y nodos
 * de respaldo sin ningún nodo de primera vuelta (fuera de saludo y contacto). Aviso: un tipo que ningún
 * nodo usa (probable error de tipeo).
 */
export function revisarTipos(tipos, nodos) {
  const errores = [];
  const avisos = [];
  if (tipos == null) return { errores, avisos };
  if (typeof tipos !== 'object' || Array.isArray(tipos)) return { errores: ['sitio.yaml: config.tipos debe ser un mapa { tipo: { peso, respaldo } }'], avisos };
  const usados = new Set(nodos.map((n) => n.tipo));
  for (const [tipo, v] of Object.entries(tipos)) {
    const donde = `sitio.yaml: config.tipos.${tipo}`;
    if (!usados.has(tipo)) avisos.push(`${donde}: ningún nodo es de tipo '${tipo}'`);
    if (v == null || typeof v !== 'object') {
      errores.push(`${donde}: se espera { peso, respaldo }`);
      continue;
    }
    for (const k of Object.keys(v)) if (!['peso', 'respaldo'].includes(k)) errores.push(`${donde}: clave '${k}' desconocida (peso, respaldo)`);
    if (v.peso !== undefined && !(typeof v.peso === 'number' && v.peso >= PESO_TIPO_MIN && v.peso <= PESO_TIPO_MAX)) {
      errores.push(`${donde}: peso '${v.peso}' fuera de ${PESO_TIPO_MIN} a ${PESO_TIPO_MAX}`);
    }
    if (v.respaldo !== undefined && typeof v.respaldo !== 'boolean') errores.push(`${donde}: respaldo debe ser true o false`);
  }
  const deRespaldo = (n) => tipos[n.tipo]?.respaldo === true;
  const candidatos = nodos.filter((n) => n.enChat && n.tipo !== 'saludo' && n.id !== 'contacto');
  if (candidatos.some(deRespaldo) && candidatos.every(deRespaldo)) {
    errores.push('sitio.yaml: config.tipos marca como respaldo todos los nodos; la primera vuelta no tendría dónde buscar');
  }
  return { errores, avisos };
}

/**
 * Un término del título repetido en más del 60 % de las preguntas del nodo, cuando ese término es el tema
 * principal de otro nodo (su título corto empieza por él o está en su primera keyword): el campo
 * preguntas suma de más y el nodo compite con el principal (un artículo que nombra el producto en cada
 * pregunta). Solo nodos con 5 preguntas o más.
 */
export function avisosRepeticion(nodos, diccionario = {}) {
  const terminos = crearTerminos(diccionario ?? {});
  const enChat = nodos.filter((n) => n.enChat);
  const principal = new Map();
  for (const n of enChat) {
    const temas = [terminos(n.titulo.split(',')[0])[0], ...terminos(n.keywords?.[0] ?? '')].filter(Boolean);
    for (const t of temas) principal.set(t, [...(principal.get(t) ?? []), n.id]);
  }
  const avisos = [];
  for (const n of enChat) {
    if (n.preguntas.length < 5) continue;
    const enPreguntas = n.preguntas.map((p) => new Set(terminos(p)));
    for (const t of new Set(terminos(n.titulo))) {
      const otros = (principal.get(t) ?? []).filter((id) => id !== n.id);
      if (!otros.length || principal.get(t).includes(n.id)) continue;
      const k = enPreguntas.filter((s) => s.has(t)).length;
      if (k / n.preguntas.length > LIMITES.repeticionPreguntas) {
        avisos.push(`${n.id}: '${t}' está en ${k} de ${n.preguntas.length} preguntas (más del 60 %) y es el tema de '${otros[0]}'; varía las preguntas para que no compitan con ese nodo`);
      }
    }
  }
  return avisos;
}

/**
 * genericas se compara como frase, sin aplicar el diccionario (derivar y excluir_si también se comparan
 * por términos con el diccionario). Si una fórmula genérica contiene una variante del diccionario y la
 * lista no trae la forma canónica, el visitante que escribe la canónica no calza.
 */
export function avisosAmbito(sitio) {
  const { mapa } = prepararDiccionario(sitio.diccionario ?? {});
  const avisos = [];
  for (const clave of ['genericas']) {
    const lista = new Set((sitio.ambito?.[clave] ?? []).map(normalizar));
    for (const entrada of sitio.ambito?.[clave] ?? []) {
      const texto = ` ${normalizar(entrada)} `;
      for (const [variante, canonica] of mapa) {
        // Sin aviso si la lista ya trae la forma canónica.
        if (texto.includes(` ${variante} `) && !lista.has(texto.replace(` ${variante} `, ` ${canonica} `).trim())) {
          avisos.push(`sitio.yaml: ambito.${clave} '${entrada}' contiene '${variante}', que el diccionario cambia por '${canonica}'; se compara sin diccionario, así que agrega también la forma con '${canonica}'`);
          break;
        }
      }
    }
  }
  return avisos;
}

/** Lee y valida la carpeta de un sitio. */
export function validarSitio(dir) {
  const sitio = leerSitio(dir);
  const { nodos, errores } = leerNodos(dir);
  return { ...validarNodos(nodos, sitio, errores), nodos };
}
