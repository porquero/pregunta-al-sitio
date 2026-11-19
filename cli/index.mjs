// pregunta-al-sitio: CLI para preparar el contenido de un sitio.
//
// La carpeta del sitio contiene:
//   sitio.yaml       nombre, ambito, diccionario, config (la escribe calibrar) y validar
//   nodos/*.md       un nodo por archivo
//   preguntas.yaml   set de evaluación (para evaluar y calibrar)
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseDocument } from 'yaml';
import { construirIndice } from './build.mjs';
import { validarSitio } from './validar.mjs';
import { evaluar, FACTOR_MOVIL } from './evaluacion/evaluar.mjs';
import { calibrar } from './evaluacion/calibrar.mjs';
import { cargarIndice, cargarPreguntas } from './evaluacion/datos.mjs';
import { cumple, resumen } from './evaluacion/metricas.mjs';
import { revisarPreguntas } from './evaluacion/preguntas.mjs';
import { iniciarSitio, instalarSkill } from './iniciar.mjs';

const WIDGET = fileURLToPath(new URL('../dist/pregunta-al-sitio.js', import.meta.url));

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
              --borradores

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
  ayuda: { type: 'boolean', short: 'h', default: false },
};

const p = (x) => `${(x * 100).toFixed(1)}%`;

function indiceDe(dir, valores) {
  if (valores.indice) return cargarIndice(valores.indice);
  const { indice, errores } = construirIndice(dir, { borradores: valores.borradores });
  for (const e of errores) console.error(`ERROR  ${e}`);
  return indice;
}

const comandos = {
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
    const { indice, errores } = construirIndice(dir, { borradores: v.borradores });
    for (const e of errores) console.error(`ERROR  ${e}`);
    const salida = v.salida ?? join(dir, 'indice.json');
    mkdirSync(dirname(resolve(salida)), { recursive: true });
    writeFileSync(salida, `${JSON.stringify(indice)}\n`);
    console.log(`${indice.nodos.length} nodos en el chat · versión ${indice.version} · ${salida}`);
    if (v.widget) {
      if (!existsSync(WIDGET)) throw new Error(`falta ${WIDGET}; corre \`npm run empaquetar\` en el repo de pregunta-al-sitio`);
      const destino = join(dirname(resolve(salida)), 'pregunta-al-sitio.js');
      copyFileSync(WIDGET, destino);
      console.log(`widget copiado en ${destino}`);
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
    console.log('\nValidación por tipo:');
    for (const [t, m] of Object.entries(s.validacionPorTipo)) {
      console.log(`  ${t.padEnd(12)} n ${String(m.n).padStart(3)} · acierto ${p(m.aciertoTotal)} · top-3 ${p(m.top3)}`);
    }
    console.log(`\nFuga sin detector de ámbito (solo puntaje): ${p(s.fugaSinDetector)}`);
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
    const r = calibrar(datos, cargarPreguntas(v.preguntas ?? join(dir, 'preguntas.yaml')));
    console.log('motor', JSON.stringify(r.config.motor));
    console.log('zonas', JSON.stringify(r.config.zonas));
    console.log(`Escala del puntaje: ${r.escala.toFixed(2)}`);
    console.log(`Ajuste (${r.ajuste.n}): ${resumen(r.ajuste.metricas)}`);
    console.log(`Validación (${r.validacion.n}): ${resumen(r.validacion.metricas)}`, cumple(r.validacion.metricas) ? '· cumple' : '· NO cumple');
    if (v.escribir) {
      const ruta = join(dir, 'sitio.yaml');
      // parseDocument conserva los comentarios del archivo.
      const doc = parseDocument(existsSync(ruta) ? readFileSync(ruta, 'utf8') : '{}');
      doc.setIn(['config', 'motor'], doc.createNode(r.config.motor));
      doc.setIn(['config', 'zonas'], doc.createNode(r.config.zonas));
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
