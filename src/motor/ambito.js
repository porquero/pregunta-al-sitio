// Detector de ámbito: decide si una consulta es sobre el sitio, conocimiento general o un tema que se deriva.
// Las reglas llegan en el índice, en la clave "ambito":
//   marcas         nombres propios del sitio, sus productos o el asistente
//   oferta         segunda persona y verbos de oferta ("ustedes", "ofrecen")
//   necesidad      necesidad propia del visitante ("mi empresa", "necesitamos")
//   genericas      fórmulas de conocimiento general ("que es", "como funciona")
//   derivar        temas fuera de las preguntas del chat (empleo, blog…): mensaje de derivación
//   derivar_salvo  palabras que anulan la derivación
//   palabras_clave_max  una consulta de hasta tantos términos con una keyword del catálogo es del sitio
//
// Resultado:
//   sitio    hay referencia al sitio: se busca normalmente.
//   general  fórmula de conocimiento general sin referencia al sitio: va a contacto aunque el puntaje sea alto.
//   mixto    fórmula general con una necesidad propia, sin marca ni segunda persona: chips
//            "Ver cómo lo trabajan" y "Escribir al equipo".
//   neutro   sin señales: decide el puntaje del buscador.
//   derivar  tema fuera de las preguntas del chat: mensaje de derivación.
import { normalizar, terminos as terminosBase } from './normalizar.js';

/**
 * Prepara las reglas una sola vez: normaliza frases y arma el vocabulario del catálogo.
 * `terminos` es la función de términos del sitio (crearTerminos con su diccionario).
 */
export function prepararAmbito(reglas, nodos = [], terminos = terminosBase) {
  const lista = (clave) => (reglas?.[clave] ?? []).map(normalizar).filter(Boolean);
  const catalogoTerminos = new Set();
  for (const n of nodos) {
    for (const k of n.keywords ?? []) {
      for (const t of terminos(k)) catalogoTerminos.add(t);
    }
  }
  return {
    marcas: lista('marcas'),
    oferta: lista('oferta'),
    necesidad: lista('necesidad'),
    genericas: lista('genericas'),
    derivar: lista('derivar'),
    derivarSalvo: lista('derivar_salvo'),
    palabrasClaveMax: Number(reglas?.palabras_clave_max ?? 3),
    catalogoTerminos,
    terminos,
  };
}

const contiene = (texto, frase) => ` ${texto} `.includes(` ${frase} `);
const encontradas = (texto, frases) => frases.filter((f) => contiene(texto, f));

/** Clasifica una consulta. `ambito` es el resultado de prepararAmbito. */
export function clasificarAmbito(consulta, ambito) {
  const terminos = ambito.terminos ?? terminosBase;
  const texto = normalizar(consulta);
  const genericas = encontradas(texto, ambito.genericas);
  // Las palabras de una fórmula genérica no cuentan como señal ("que son" no es "son").
  let resto = ` ${texto} `;
  for (const g of genericas) resto = resto.replaceAll(` ${g} `, ' ');
  resto = resto.trim();

  const senales = {
    marcas: encontradas(resto, ambito.marcas),
    oferta: encontradas(resto, ambito.oferta),
    necesidad: encontradas(resto, ambito.necesidad),
    genericas,
  };
  const utiles = terminos(texto);
  const palabraClave = utiles.length > 0
    && utiles.length <= ambito.palabrasClaveMax
    && utiles.some((t) => ambito.catalogoTerminos.has(t));

  senales.derivar = encontradas(texto, ambito.derivar ?? []);
  const salvo = encontradas(texto, ambito.derivarSalvo ?? []).length > 0;

  let tipo;
  if (senales.derivar.length > 0 && !salvo) {
    tipo = 'derivar';
  } else if (genericas.length > 0) {
    if (senales.marcas.length || senales.oferta.length) tipo = 'sitio';
    else if (senales.necesidad.length) tipo = 'mixto';
    else tipo = 'general';
  } else if (senales.marcas.length || senales.oferta.length || senales.necesidad.length || palabraClave) {
    tipo = 'sitio';
  } else {
    tipo = 'neutro';
  }
  return { tipo, senales, palabraClave };
}
