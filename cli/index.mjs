// pregunta-al-sitio: CLI para preparar el contenido de un sitio.
//
// La carpeta del sitio contiene:
//   sitio.yaml       nombre, ambito, diccionario, config (la escribe calibrar) y validar
//   nodos/*.md       un nodo por archivo
//   preguntas.yaml   set de evaluación (para evaluar y calibrar)
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseDocument } from 'yaml';
import { construirIndice } from './build.mjs';
import { validarSitio } from './validar.mjs';
import { evaluar, FACTOR_MOVIL } from './evaluacion/evaluar.mjs';
import { calibrar } from './evaluacion/calibrar.mjs';
import { cargarIndice, cargarPreguntas } from './evaluacion/datos.mjs';
import { cumple, resumen, intervalos } from './evaluacion/metricas.mjs';
import { revisarPreguntas } from './evaluacion/preguntas.mjs';
import { iniciarSitio, instalarSkill } from './iniciar.mjs';
import { widgetAlDia } from './empaquetar.mjs';
import { cobertura } from './cobertura.mjs';
import { vocabulario, leerFuentes } from './vocabulario.mjs';
import { leerSitio } from './contenido/leer.mjs';

const AYUDA = `Uso: pregunta-al-sitio <comando> [carpeta] [opciones]

Comandos:
  iniciar   crea la carpeta de un sitio nuevo con plantillas (no sobrescribe)
              --nombre <texto>      nombre del sitio
              --sitio <dominio>     dominio principal (misitio.cl): el chat solo enlaza ahí
  skill     copia la guía de contenido como skill de Claude Code
              (en <carpeta>/.claude/skills/pregunta-al-sitio-contenido)
  build     arma indice.json desde sitio.yaml y nodos/*.md
              -o, --salida <ruta>   destino (por defecto <carpeta>/indice.json)
              --borradores          incluye los nodos en borrador
              --widget              copia pregunta-al-sitio.js junto al índice
  validar   revisa los nodos; sale con código 1 si hay errores
              --silencioso          no muestra los avisos
  evaluar   revisa preguntas.yaml y mide el resolvedor con él
              --preguntas <ruta>    set de evaluación (por defecto <carpeta>/preguntas.yaml)
              --indice <ruta>       usa un indice.json ya armado en vez de la carpeta
              --json <ruta>         guarda el informe completo
              --borradores          incluye los nodos en borrador
  calibrar  elige parámetros del motor y umbrales de zona con preguntas.yaml
              --preguntas <ruta>
              --escribir            guarda el resultado en la clave config de sitio.yaml
              --max-falso-rechazo <n>  máximo de falso rechazo (0.05 o 5%; por defecto el objetivo, 5 %)
              --borradores
  cobertura lista las fuentes con línea URL: sin un nodo cuyo enlace sea esa URL
              --fuentes <carpeta>   carpeta de fuentes (por defecto fuentes/ junto a la carpeta)
              --normalizar          ignora ".html", "index.html" y la barra final al comparar
              Sale con código 1 si alguna fuente no tiene nodo.
  vocabulario lista las palabras frecuentes de las fuentes que el chat no responde (terminan en contacto)
              --fuentes <carpeta>   carpeta de fuentes (por defecto fuentes/ junto a la carpeta)
              --min <n>             mínimo de apariciones (por defecto 5)
              --largo <n>           largo mínimo de la palabra (por defecto 5)
              --borradores          incluye los nodos en borrador
              Las palabras que no deben tener nodo van en sitio.yaml > vocabulario.ignorar.
              Sale con código 1 si alguna palabra queda sin respuesta.

La carpeta por defecto es la actual.`;

const OPCIONES = {
  salida: { type: 'string', short: 'o' },
  borradores: { type: 'boolean', default: false },
  silencioso: { type: 'boolean', default: false },
  preguntas: { type: 'string' },
  indice: { type: 'string' },
  json: { type: 'string' },
  escribir: { type: 'boolean', default: false },
  nombre: { type: 'string' },
  sitio: { type: 'string' },
  widget: { type: 'boolean', default: false },
  fuentes: { type: 'string' },
  normalizar: { type: 'boolean', default: false },
  min: { type: 'string' },
  largo: { type: 'string' },
  'max-falso-rechazo': { type: 'string' },
  ayuda: { type: 'boolean', short: 'h', default: false },
};

const p = (x) => `${(x * 100).toFixed(1)}%`;

/** "5%", "5" o "0.05" → 0.05. */
function porcentaje(texto) {
  const n = Number(String(texto).replace('%', '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0) throw new Error(`valor inválido: ${texto}`);
  return String(texto).includes('%') || n > 1 ? n / 100 : n;
}

function indiceDe(dir, valores) {
  if (valores.indice) return cargarIndice(valores.indice);
  const { indice, errores } = construirIndice(dir, { borradores: valores.borradores });
  for (const e of errores) console.error(`ERROR  ${e}`);
  return indice;
}

const comandos = {
  cobertura(dir, v) {
    const carpeta = v.fuentes ?? join(dir, '..', 'fuentes');
    const { fuentes, sinNodo } = cobertura(dir, carpeta, { normalizar: v.normalizar });
    for (const s of sinNodo) console.log(`sin nodo  ${s.url}  (${s.archivo})`);
    const excluidas = fuentes.filter((x) => x.excluida).length;
    console.log(`\n${fuentes.length} fuentes con URL · ${fuentes.length - sinNodo.length - excluidas} con nodo · ${excluidas} excluidas · ${sinNodo.length} sin nodo`);
    console.log(
      v.normalizar
        ? 'URL normalizadas: sin ".html", "index.html" ni barra final.'
        : 'URL comparadas tal cual, sin barra final. Si las fuentes traen ".html" y el sitio no, usa --normalizar.',
    );
    if (sinNodo.length) {
      console.log('Regla: una fuente con URL: es un nodo con enlace igual a esa URL (excepciones en sitio.yaml > cobertura.excluir).');
    }
    return sinNodo.length ? 1 : 0;
  },

  vocabulario(dir, v) {
    const carpeta = v.fuentes ?? join(dir, '..', 'fuentes');
    const entero = (x, defecto) => (x === undefined ? defecto : Math.max(1, Number.parseInt(x, 10) || defecto));
    const sitio = leerSitio(dir);
    const { total, sinResultado } = vocabulario(indiceDe(dir, v), leerFuentes(carpeta), {
      min: entero(v.min, 5),
      largoMin: entero(v.largo, 5),
      ignorar: sitio.vocabulario?.ignorar ?? [],
    });
    for (const s of sinResultado) console.log(`sin resultado  ${s.palabra}  (${s.veces} veces)`);
    console.log(`
${total} palabras frecuentes · ${total - sinResultado.length} con resultado · ${sinResultado.length} sin resultado`);
    if (sinResultado.length) {
      console.log('Agrega cada palabra a keywords o sinonimos del nodo que corresponda, crea un nodo si el tema falta, o a sitio.yaml > vocabulario.ignorar si es administrativa.');
    }
    return sinResultado.length ? 1 : 0;
  },

  skill(dir) {
    console.log(`Guía instalada en ${instalarSkill(dir)}`);
    return 0;
  },

  iniciar(dir, v) {
    const creados = iniciarSitio(dir, { nombre: v.nombre, sitio: v.sitio });
    for (const f of creados) console.log(`creado  ${join(dir, f)}`);
    console.log(
      '\nSiguiente: deja las páginas y documentos del sitio en fuentes/, corre `pregunta-al-sitio skill`' +
        '\ny pide a Claude Code "Prepara el contenido de pregunta-al-sitio a partir de fuentes/".',
    );
    return 0;
  },

  build(dir, v) {
    // El widget se comprueba antes de escribir nada: si está viejo, build falla sin dejar medio trabajo.
    const widget = v.widget ? widgetAlDia() : null;
    const { indice, errores, avisos, omitidos, dominios } = construirIndice(dir, { borradores: v.borradores });
    for (const e of errores) console.error(`ERROR  ${e}`);
    for (const a of avisos) console.log(`aviso  ${a}`);
    const salida = v.salida ?? join(dir, 'indice.json');
    mkdirSync(dirname(resolve(salida)), { recursive: true });
    writeFileSync(salida, `${JSON.stringify(indice)}\n`);
    console.log(`${indice.nodos.length} nodos en el chat · versión ${indice.version} · ${salida}`);
    if (omitidos) {
      console.log(`${omitidos} enlace(s) omitido(s) por estar fuera de ${dominios.join(', ') || 'las rutas del sitio (falta sitio)'} · detalle: pregunta-al-sitio validar`);
    }
    if (widget) {
      const destino = join(dirname(resolve(salida)), 'pregunta-al-sitio.js');
      copyFileSync(widget.ruta, destino);
      console.log(`widget ${widget.empaquetado ? 'empaquetado y ' : ''}copiado en ${destino}`);
    }
    return errores.length ? 1 : 0;
  },

  validar(dir, v) {
    const { errores, avisos, nodos } = validarSitio(dir);
    for (const e of errores) console.error(`ERROR  ${e}`);
    if (!v.silencioso) for (const a of avisos) console.log(`aviso  ${a}`);
    const aprobados = nodos.filter((n) => n.estado === 'aprobado').length;
    console.log(`\n${nodos.length} nodos (${aprobados} aprobados, ${nodos.length - aprobados} en borrador) · ${errores.length} errores · ${avisos.length} avisos`);
    return errores.length ? 1 : 0;
  },

  evaluar(dir, v) {
    const datos = indiceDe(dir, v);
    const consultas = cargarPreguntas(v.preguntas ?? join(dir, 'preguntas.yaml'));
    const revision = revisarPreguntas(consultas, datos);
    for (const e of revision.errores) console.error(`ERROR  ${e}`);
    for (const a of revision.avisos) console.log(`aviso  ${a}`);
    if (revision.errores.length) return 1;
    if (revision.avisos.length) console.log('');
    const s = evaluar(datos, consultas);
    console.log(`Índice ${s.version} · ${datos.nodos.length} nodos · ajuste ${s.tamanos.ajuste} · validación ${s.tamanos.validacion}\n`);
    console.log(`Validación: ${resumen(s.validacion)}`, cumple(s.validacion) ? '· cumple' : '· NO cumple');
    console.log(`Ajuste:     ${resumen(s.ajuste)}`);
    console.log(`Intervalos de validación (Wilson 95 %): ${intervalos(s.validacion)}`);
    for (const a of s.avisos) console.log(`aviso  ${a}`);
    if (s.porFamilia) {
      console.log('\nValidación por familia de nodo (config.tipos):');
      for (const [fam, m] of Object.entries(s.porFamilia)) console.log(`  ${fam.padEnd(9)} n ${String(m.n).padStart(3)} · ${resumen(m)}`);
    }
    if (s.segundaVuelta) {
      console.log(`Resueltas en la segunda vuelta (nodos de respaldo): validación ${s.segundaVuelta.validacion} · ajuste ${s.segundaVuelta.ajuste}`);
    }
    console.log('\nValidación por tipo:');
    for (const [t, m] of Object.entries(s.validacionPorTipo)) {
      console.log(`  ${t.padEnd(12)} n ${String(m.n).padStart(3)} · acierto ${p(m.aciertoTotal)} · top-3 ${p(m.top3)}`);
    }
    console.log(`\nFuga sin detector de ámbito (solo puntaje): ${p(s.fugaSinDetector)}`);
    if (s.seguimiento.n) {
      console.log(`Seguimiento (${s.seguimiento.n}, fuera de las métricas: el chat responde sin contexto): acierto ${p(s.seguimiento.acierto)}`);
    }
    const linea = (e) => `  [${e.tipo}] "${e.consulta}" → ${e.zona} ${e.obtenido.join(', ')} (esperado ${e.esperado.join(' | ')})`;
    // Los de ajuste son los que se corrigen; los de validación muestran cuánto generaliza.
    console.log(`\nErrores en ajuste (${s.erroresAjuste.length}):`);
    for (const e of s.erroresAjuste) console.log(linea(e));
    console.log(`\nErrores en validación (${s.errores.length}):`);
    for (const e of s.errores) console.log(linea(e));
    const t = s.medicion;
    console.log(
      `\nÍndice ${(t.indice / 1024).toFixed(1)} KB (${(t.indiceGz / 1024).toFixed(1)} KB gzip) · carga ${t.carga.toFixed(1)} ms` +
        ` · consulta ${t.consulta.toFixed(3)} ms · móvil est. ${(t.carga * FACTOR_MOVIL).toFixed(0)} ms / ${(t.consulta * FACTOR_MOVIL).toFixed(2)} ms`,
    );
    if (v.json) writeFileSync(v.json, JSON.stringify(s, null, 2));
    return cumple(s.validacion) ? 0 : 1;
  },

  calibrar(dir, v) {
    const datos = indiceDe(dir, v);
    const maxFalsoRechazo = v['max-falso-rechazo'] === undefined ? null : porcentaje(v['max-falso-rechazo']);
    const r = calibrar(datos, cargarPreguntas(v.preguntas ?? join(dir, 'preguntas.yaml')), { maxFalsoRechazo });
    console.log('motor', JSON.stringify(r.config.motor));
    console.log('zonas', JSON.stringify(r.config.zonas));
    console.log(`Escala del puntaje: ${r.escala.toFixed(2)}`);
    console.log(`Ajuste (${r.ajuste.n}): ${resumen(r.ajuste.metricas)}`);
    console.log(`Validación (${r.validacion.n}): ${resumen(r.validacion.metricas)}`, cumple(r.validacion.metricas) ? '· cumple' : '· NO cumple');
    console.log(`\nCompromiso falso rechazo / fuga por umbral Cm (máximo de falso rechazo ${p(r.objetivo.falsoRechazo)}):`);
    console.log('  Cm    ajuste: f. rechazo  fuga   · validación: f. rechazo  fuga');
    for (const c of r.compromiso) {
      const col = (x) => p(x).padStart(6);
      console.log(`  ${c.Cm.toFixed(2)}          ${col(c.ajuste.falsoRechazo)} ${col(c.ajuste.fuga)}   ·             ${col(c.validacion.falsoRechazo)} ${col(c.validacion.fuga)}${c.elegido ? '  ← elegido' : ''}`);
    }
    console.log(`
Intervalos de validación (Wilson 95 %): ${intervalos(r.validacion.metricas)}`);
    for (const a of r.avisos) console.log(`aviso  ${a}`);
    console.log(`Normalización por largo de consulta: ${r.config.normaPorTerminos ? 'sí' : 'no'} · saturación en preguntas: ${r.config.motor.tfLog?.length ? 'sí' : 'no'}`);
    const s = r.sintetica;
    console.log(`
Comprobación sintética (título corto y primera keyword de cada nodo): ${s.aContacto.length} de ${s.total} terminan en contacto`);
    for (const x of s.aContacto) console.log(`  "${x.consulta}" (${x.nodo})`);
    if (r.validacion.metricas.falsoRechazo > r.objetivo.falsoRechazo) {
      console.log(`Ningún umbral deja el falso rechazo de validación bajo ${p(r.objetivo.falsoRechazo)}: revisa los errores con evaluar.`);
    }
    if (v.escribir) {
      const ruta = join(dir, 'sitio.yaml');
      // parseDocument conserva los comentarios del archivo.
      const doc = parseDocument(existsSync(ruta) ? readFileSync(ruta, 'utf8') : '{}');
      doc.setIn(['config', 'motor'], doc.createNode(r.config.motor));
      doc.setIn(['config', 'zonas'], doc.createNode(r.config.zonas));
      doc.setIn(['config', 'normaPorTerminos'], r.config.normaPorTerminos);
      writeFileSync(ruta, doc.toString({ lineWidth: 0 }));
      console.log(`config escrita en ${ruta}; vuelve a correr build`);
    }
    return 0;
  },
};

export function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPCIONES, allowPositionals: true });
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const [comando, dir = '.'] = parsed.positionals;
  if (parsed.values.ayuda || !comando) {
    console.log(AYUDA);
    return comando || parsed.values.ayuda ? 0 : 2;
  }
  if (!Object.hasOwn(comandos, comando)) {
    console.error(`Comando desconocido: ${comando}\n\n${AYUDA}`);
    return 2;
  }
  try {
    return comandos[comando](dir, parsed.values);
  } catch (e) {
    console.error(`ERROR  ${e.message}`);
    return 1;
  }
}
