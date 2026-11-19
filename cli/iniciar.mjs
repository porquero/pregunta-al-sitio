// iniciar: crea la carpeta de contenido de un sitio nuevo con plantillas que ya pasan `validar` y `build`.
//   sitio.yaml, nodos/inicio.md (saludo), nodos/contacto.md, preguntas.yaml e informes/
// Los textos de las plantillas son instrucciones marcadas con [REDACTAR]: los nodos nacen en borrador.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUIA = fileURLToPath(new URL('../guia-contenido/', import.meta.url));

const lista = (items, sangria = '    ') => items.map((i) => `${sangria}- ${i}`).join('\n');

// Listas genéricas del detector de ámbito para un sitio en español. Se ajustan por sitio.
const OFERTA = [
  'ustedes', 'usted', 'les', 'ofrecen', 'tienen', 'hacen', 'trabajan', 'pueden', 'cobran', 'cotizan',
  'venden', 'atienden', 'usan', 'implementan', 'entregan', 'aceptan', 'responden',
];
const NECESIDAD = [
  'mi empresa', 'mi negocio', 'mis datos', 'mis clientes', 'nuestro', 'nuestra', 'necesito', 'necesitamos',
  'quiero', 'queremos', 'tengo', 'tenemos', 'contratar', 'precio', 'precios', 'cuanto cuesta', 'cuanto sale',
  'cotizacion', 'cotizar', 'presupuesto', 'reunion', 'soporte', 'plazo', 'me sirve', 'puedo', 'ayuda', 'soy cliente',
];
const GENERICAS = [
  'que es', 'que son', 'que significa', 'que quiere decir', 'como funciona', 'como funcionan', 'como se hace',
  'como se usa', 'como hago', 'para que sirve', 'para que sirven', 'diferencia entre', 'diferencias entre',
  'ventajas de', 'desventajas de', 'definicion de', 'explicame', 'es mejor', 'cual es mejor', 'cual es el mejor',
  'quien gano', 'quien invento', 'cual es la capital', 'que tipos de', 'ejemplos de', 'como se configura',
  'como se instala', 'como se calcula',
];
const DERIVAR = [
  'estan contratando', 'buscan personal', 'busco trabajo', 'busco empleo', 'empleo', 'oferta laboral',
  'ofertas laborales', 'curriculum', 'cv', 'postular', 'practica profesional',
];

export function plantillaSitio(nombre, dominio = null) {
  const marca = nombre.toLowerCase();
  return `# Contenido de "${nombre}" para pregunta-al-sitio.
# Guía: guia-contenido/SKILL.md del paquete. Comandos: validar, build, evaluar, calibrar.

nombre: ${nombre}

# Dominio principal del sitio (misitio.cl). Las respuestas del chat solo enlazan a él y a sus
# subdominios, con cualquier ruta; los enlaces a otros sitios se omiten para que el visitante no salga.
# Sin dominio, solo quedan las rutas relativas (/contacto). Admite una lista.
sitio: ${dominio ?? ''}

# Parámetros del motor y umbrales de zona. Los escribe \`pregunta-al-sitio calibrar --escribir\`.
config: {}

# Reglas de estilo de \`validar\`.
validar:
  respuesta:
    palabras_min: 40
    palabras_max: 60
    # Nombre que debería aparecer en cada respuesta corta (aviso si falta). Ayuda a buscadores y asistentes.
    nombrar: ${nombre}
    nombrar_salvo: [saludo]
  preguntas:
    min: 6
    max: 12
  # Expresiones regulares propias del sitio: { patron, mensaje, nivel: error | aviso, campo, sensible }.
  reglas: []

# Sinónimos del sitio: variante → forma canónica. Se suman a la base del motor (whatsapp, correo, gratis…).
# Úsalo para jerga, siglas y productos que el visitante escribe distinto de como los nombra el sitio.
diccionario: {}

# Detector de ámbito. Todo se compara sin tildes ni mayúsculas, como palabras o frases completas.
ambito:
  # Nombres propios del sitio, sus marcas y productos, y el asistente mismo.
  marcas:
${lista([marca, 'este asistente', 'este chat', 'este sitio', 'esta pagina'])}
  # Segunda persona y verbos de oferta: convierten "¿qué es X?" en una pregunta sobre el sitio.
  oferta:
${lista(OFERTA)}
  # Necesidad propia del visitante.
  necesidad:
${lista(NECESIDAD)}
  # Fórmulas de conocimiento general. Sin señales del sitio, la consulta va a contacto.
  genericas:
${lista(GENERICAS)}
  # Temas que el chat no responde y deriva siempre (empleo, por ejemplo).
  derivar:
${lista(DERIVAR)}
  # Palabras que anulan "derivar".
  derivar_salvo: []
  palabras_clave_max: 3
`;
}

export function plantillaInicio(nombre) {
  return `---
id: inicio
tipo: saludo
titulo: Asistente de ${nombre}
enlace: /
respuesta_corta: >-
  [REDACTAR saludo de bienvenida del chat, entre cuarenta y sesenta palabras. Presenta en una frase qué
  hace ${nombre}, invita a preguntar y nombra dos o tres temas que el chat sabe responder, como servicios,
  precios, horarios o contacto. Sin promesas comerciales ni exclamaciones.]
preguntas:
  - Hola
  - Buenas tardes
  - ¿Qué puedo preguntar acá?
  - ¿Cómo funciona este chat?
  - ¿Con quién hablo?
  - ¿Qué es ${nombre}?
keywords: [hola, inicio, asistente]
sinonimos: [buenas, saludos]
aristas:
  - { a: contacto, tipo: cta, peso: 0.6 }
chips: []
estado: borrador
---
`;
}

export function plantillaContacto(nombre) {
  return `---
id: contacto
tipo: contacto
titulo: Contacto
enlace: /contacto
respuesta_corta: >-
  [REDACTAR cómo contactar a ${nombre}, entre cuarenta y sesenta palabras: canales (correo, teléfono,
  WhatsApp, formulario), horario de atención y tiempo de respuesta esperado. Es también la respuesta a las
  consultas que el chat no sabe contestar, así que conviene invitar a dejar la pregunta al equipo.]
derivacion: >-
  Este asistente responde sobre ${nombre}. Tu consulta la revisa una persona del equipo; déjala aquí y te
  escribimos.
preguntas:
  - ¿Cómo los contacto?
  - Quiero hablar con una persona
  - ¿Tienen WhatsApp?
  - ¿Cuál es el correo?
  - ¿En qué horario atienden?
  - ¿Cuánto se demoran en responder?
keywords: [contacto, correo, telefono, whatsapp, horario]
sinonimos: [escribirles, llamarlos, hablar con alguien]
aristas: []
estado: borrador
---
`;
}

export const PLANTILLA_PREGUNTAS = `# Set de evaluación del buscador. Lo usan \`evaluar\` y \`calibrar\`.
#
# Campos:
#   consulta  texto tal como lo escribiría un visitante. No copies las preguntas de los nodos.
#   esperado  id de nodo, lista de ids aceptables o "contacto" (derivar al equipo).
#   tipo      anexo | coloquial | tipeo | multiple | general | necesidad | ajena | fuera | seguimiento
#   frontera  true en las de conocimiento general que comparten vocabulario con nodos.
#   contexto  id del nodo mostrado justo antes (solo en seguimiento).
#
# Composición mínima: 150 consultas; 30 generales (15 de frontera), 15 de necesidad y 10 ajenas.
# La partición 60/40 (ajuste/validación) se calcula por orden dentro de cada tipo.

consultas:
  - { consulta: "hola", esperado: inicio, tipo: ajena }
  - { consulta: "como les escribo", esperado: contacto, tipo: coloquial }
  - { consulta: "¿Qué es la inflación?", esperado: contacto, tipo: general }
`;

/** Crea la carpeta. No sobrescribe: si ya hay un sitio.yaml, lanza un Error. */
export function iniciarSitio(dir, { nombre = 'Mi sitio', sitio = null } = {}) {
  if (existsSync(join(dir, 'sitio.yaml'))) throw new Error(`ya existe ${join(dir, 'sitio.yaml')}`);
  const archivos = {
    'sitio.yaml': plantillaSitio(nombre, sitio),
    'nodos/inicio.md': plantillaInicio(nombre),
    'nodos/contacto.md': plantillaContacto(nombre),
    'preguntas.yaml': PLANTILLA_PREGUNTAS,
    'informes/.gitkeep': '',
  };
  const creados = [];
  for (const [ruta, texto] of Object.entries(archivos)) {
    const destino = join(dir, ruta);
    if (existsSync(destino)) continue;
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, texto);
    creados.push(ruta);
  }
  return creados;
}

/** Copia la guía de contenido como skill de Claude Code en <dir>/.claude/skills/pregunta-al-sitio-contenido. */
export function instalarSkill(dir = '.') {
  const destino = join(dir, '.claude', 'skills', 'pregunta-al-sitio-contenido');
  mkdirSync(destino, { recursive: true });
  cpSync(GUIA, destino, { recursive: true });
  return destino;
}
