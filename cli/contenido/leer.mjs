// Lectura del contenido de un sitio:
//   <dir>/sitio.yaml   nombre, ambito, diccionario, config, validar
//   <dir>/nodos/*.md   un nodo por archivo: frontmatter YAML entre líneas "---" y cuerpo Markdown
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';

export const ESTADOS = ['borrador', 'aprobado'];
export const FORMATOS = ['texto', 'tarjeta'];

/** Lee sitio.yaml. Sin archivo, un sitio vacío. */
export function leerSitio(dir) {
  const ruta = join(dir, 'sitio.yaml');
  if (!existsSync(ruta)) return {};
  return parse(readFileSync(ruta, 'utf8')) ?? {};
}

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const texto = (v) => (v === undefined || v === null ? null : String(v).trim());

/** Destino de "Ver más": enlace; por compatibilidad, enlace_externo, ruta o pagina_padre. */
function enlaceDe(d) {
  if (d.enlace) return String(d.enlace);
  if (d.enlace_externo) return String(d.enlace_externo);
  const enPagina = d.publicacion?.pagina ?? true;
  if (enPagina && d.ruta) return String(d.ruta);
  return d.pagina_padre ? String(d.pagina_padre) : null;
}

/** Nombres con que el autoenlace reconoce un nodo: el título hasta la primera coma, los alias y los sinónimos con +. */
export const nombresEnlazables = (n) => [n.titulo.split(',')[0].trim(), ...n.alias, ...n.sinonimosEnlazables].filter(Boolean);

/** Texto de un archivo .md → nodo normalizado. Lanza un Error si falta lo indispensable. */
export function parsearNodo(contenido, archivo = 'nodo.md') {
  const t = String(contenido).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) throw new Error('falta el frontmatter');
  const d = parse(m[1]) ?? {};
  if (typeof d !== 'object' || Array.isArray(d)) throw new Error('frontmatter inválido');
  for (const campo of ['id', 'tipo', 'titulo', 'respuesta_corta']) {
    if (d[campo] === undefined || d[campo] === null || d[campo] === '') throw new Error(`falta '${campo}'`);
  }
  return {
    id: String(d.id),
    tipo: String(d.tipo),
    titulo: String(d.titulo).trim(),
    formato: String(d.formato ?? 'texto'),
    variante: d.variante === undefined || d.variante === null ? null : String(d.variante),
    respuestaCorta: String(d.respuesta_corta).trim(),
    tarjeta: d.tarjeta && typeof d.tarjeta === 'object' ? d.tarjeta : {},
    preguntas: lista(d.preguntas).map(String),
    keywords: lista(d.keywords).map(String),
    // Un sinónimo con prefijo + también es un nombre enlazable del nodo (ver nombresEnlazables).
    sinonimos: lista(d.sinonimos).map((s) => String(s).replace(/^\+\s*/, '')),
    alias: lista(d.alias).map(String),
    // autoenlazar: false excluye el nodo del autoenlace: sus nombres no se enlazan en otras respuestas.
    autoenlazar: d.autoenlazar !== false,
    sinonimosEnlazables: lista(d.sinonimos).map(String).filter((s) => s.startsWith('+')).map((s) => s.slice(1).trim()),
    aristas: lista(d.aristas).map((a) => ({ a: String(a?.a ?? ''), tipo: String(a?.tipo ?? 'profundiza'), peso: Number(a?.peso ?? 0.5) })),
    // Un chip es un texto que se consulta al motor, o { texto, a } que abre el nodo "a" directamente.
    chips: lista(d.chips).map((c) =>
      c && typeof c === 'object' ? { texto: String(c.texto ?? ''), a: c.a ? String(c.a) : null } : { texto: String(c), a: null },
    ),
    faq: lista(d.faq),
    enChat: d.publicacion?.chat ?? true,
    enlace: enlaceDe(d),
    estado: String(d.estado ?? 'borrador'),
    derivacion: texto(d.derivacion),
    cuerpo: m[2].trim(),
    archivo: basename(archivo),
  };
}

/**
 * Lee <dir>/nodos/*.md en orden alfabético. Devuelve los nodos y los errores de lectura
 * (un archivo con error no impide leer los demás).
 */
export function leerNodos(dir) {
  const carpeta = join(dir, 'nodos');
  if (!existsSync(carpeta)) return { nodos: [], errores: [`no existe la carpeta ${carpeta}`] };
  const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.md')).sort();
  const nodos = [];
  const errores = [];
  for (const f of archivos) {
    try {
      nodos.push(parsearNodo(readFileSync(join(carpeta, f), 'utf8'), f));
    } catch (e) {
      errores.push(`${f}: ${e.message}`);
    }
  }
  return { nodos, errores };
}
