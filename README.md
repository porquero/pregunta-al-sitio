# pregunta-al-sitio

Chat flotante que responde preguntas con el contenido de tu sitio. El buscador (BM25F con tolerancia
a errores de tipeo, sinónimos y detector de ámbito) corre en el navegador: no usa un LLM ni un backend
al responder. v1 solo en español.

> Estado: fases 1 (motor), 2 (CLI) y 3 (widget). La guía de contenido y la publicación vienen después.

## Instalación en un sitio

1. Arma el índice con el CLI (más abajo) y publícalo junto al sitio, por ejemplo en `/indice.json`.
2. Agrega el script:

```html
<script src="pregunta-al-sitio.js" data-indice="/indice.json"
        data-contacto-enlace="https://wa.me/56900000000?text={mensaje}" defer></script>
```

Aparece un botón flotante que abre el chat. El índice se descarga recién al abrirlo. La conversación
queda en `localStorage` del visitante y se restaura al volver.

Opciones como atributos `data-*` del script, o en `window.PreguntaAlSitioConfig` antes del script
(los atributos tienen prioridad):

| Opción | Atributo | Uso |
|---|---|---|
| `indice` | `data-indice` | URL de `indice.json` (obligatoria) |
| `titulo` | `data-titulo` | título del panel y del botón |
| `posicion` | `data-posicion` | `derecha` o `izquierda` |
| `tema` | `data-tema` | `claro`, `oscuro` o `auto` |
| `abierto` | `data-abierto` | abre el panel al cargar |
| `contacto.enlace` | `data-contacto-enlace` | URL con `{mensaje}`: `mailto:`, WhatsApp u otra |
| `contacto.webhook` | `data-contacto-webhook` | formulario (mensaje, nombre, email) que envía por POST a esa URL |
| `contacto.formato` | `data-contacto-formato` | `json` (por defecto) o `form`, que evita el preflight CORS |
| `contacto.consentimiento` | `data-contacto-consentimiento` | casilla obligatoria con ese texto (`true` usa uno por defecto) |
| `contacto.privacidad` | `data-contacto-privacidad` | enlace a la política de privacidad |
| `sinRespuesta` | `data-sin-respuesta` | URL que recibe `{ tokens }` de las consultas sin respuesta |
| `textos` | — | reemplaza cualquier texto de la interfaz (ver `src/widget/opciones.js`) |

El webhook recibe `{ mensaje, nombre, email, consentimiento, ruta, pagina, indice, fecha }`; `ruta`
son los ids de los nodos que la persona vio. El resto de la conversación no sale del navegador.

Colores y fuente con variables CSS:

```css
pregunta-al-sitio { --pas-acento: #0a7d5a; --pas-fuente: "Inter", sans-serif; --pas-radio: 12px; }
```

Cualquier enlace o botón con `data-pregunta-al-sitio="¿Tienen hosting?"` abre el chat y hace esa
pregunta (vacío solo abre). Por código: `PreguntaAlSitio.montar(opciones)` devuelve el elemento, con
`abrir()`, `cerrar()`, `preguntar(texto)` y `borrar()`.

Accesibilidad: el panel es un `dialog` no modal con nombre, el registro es `role="log"` con anuncios
corteses, todos los controles tienen etiqueta, Escape cierra y devuelve el foco al botón, objetivos
táctiles de 40 px o más, respeta `prefers-reduced-motion` y ocupa toda la pantalla bajo 480 px.

## Contenido de un sitio

```
contenido/
  sitio.yaml       nombre, ambito, diccionario, config (la escribe calibrar) y validar
  nodos/*.md       un nodo por archivo: frontmatter YAML y cuerpo Markdown
  preguntas.yaml   set de evaluación: consulta, esperado, tipo
```

Un nodo:

```markdown
---
id: hosting
tipo: servicio
titulo: Hosting empresarial
respuesta_corta: >-
  Respuesta de 40 a 60 palabras que el chat muestra. Admite **negrita** y [enlaces](/contacto).
enlace: /hosting                # "Ver más"; también se aceptan ruta, pagina_padre y enlace_externo
formato: tarjeta                # texto | tarjeta
variante: servicio              # con tarjeta: servicio, proceso, cifras…
tarjeta: { eyebrow: Servicio, items: [SSL automático, Respaldos], etiquetas: [cPanel], cta: { texto: Cotizar, destino: /contacto } }
preguntas: [¿Tienen hosting?, ¿Qué incluye el hosting?]
keywords: [hosting, ssl]
sinonimos: [hospedaje]
aristas: [{ a: contacto, tipo: cta, peso: 0.7 }]
chips: [¿Hacen respaldos?, { texto: Hablar con el equipo, a: contacto }]
estado: aprobado                # borrador | aprobado
---
Cuerpo opcional (no se usa en el chat).
```

El nodo con id `contacto` recibe las consultas sin respuesta; su campo `derivacion` es el texto que
se muestra en ese caso.

## CLI

```bash
npx pregunta-al-sitio validar contenido
npx pregunta-al-sitio build contenido -o public/indice.json
npx pregunta-al-sitio evaluar contenido
npx pregunta-al-sitio calibrar contenido --escribir
```

- `validar` revisa estructura (ids, estados, chips y aristas hacia nodos que existen) y estilo según
  `sitio.yaml > validar`: largo de la respuesta, preguntas mínimas, tipos y variantes permitidas, un
  nombre que debería aparecer y reglas propias con expresiones regulares. Sale con 1 si hay errores.
- `build` arma `indice.json`: solo nodos aprobados (`--borradores` incluye los demás), con la respuesta
  ya en HTML escapado y los chips de seguimiento.
- `evaluar` informa top-1, top-3, precisión en zona alta, fuga y falso rechazo en la partición de
  validación, más errores y tiempos. Sale con 1 si no cumple los objetivos.
- `calibrar` elige parámetros del motor y umbrales de zona en la partición de ajuste, exigiendo
  precisión alta de 99 %. Con `--escribir` los guarda en `sitio.yaml` (conserva los comentarios).

Objetivos por sitio: top-3 ≥ 90 %, precisión en zona alta ≥ 95 %, fuga de conocimiento general ≤ 3 %
y falso rechazo ≤ 5 %.

## Motor

```js
import { crearResolver } from 'pregunta-al-sitio/motor';

const r = crearResolver(await (await fetch('/indice.json')).json());
r.resolver('¿Tienen hosting?');
// → { zona: 'alta' | 'media' | 'mixta' | 'baja', nodos, ambito, senales, terminos, derivacion, candidatos }
```

El índice (`indice.json`) trae:

| Clave | Contenido |
|---|---|
| `version` | hash del contenido |
| `nombre` | nombre del sitio |
| `nodos` | `{ id, tipo, formato, variante, titulo, preguntas, keywords, sinonimos, aristas, chips, enlace, seguimiento, respuesta }` |
| `diccionario` | sinónimos del sitio (`variante: canónica`), que se suman al diccionario base; `null` quita una entrada de la base |
| `ambito` | reglas del detector: `marcas`, `oferta`, `necesidad`, `genericas`, `derivar`, `derivar_salvo` |
| `derivacion` | texto que se muestra cuando la consulta va a contacto |
| `config` | `{ motor, zonas, opcionesMedia }`; lo que falte se toma de `src/motor/config.js` |

## Desarrollo

Node 20 o superior. `npm install` y `npm test`. El fixture de referencia es Playa SPA
(`tests/fixtures/playa`); después de cambiar sus nodos, `node cli/bin.mjs build tests/fixtures/playa`.

Widget: `npm run empaquetar` genera `dist/pregunta-al-sitio.js` (un solo archivo, sin dependencias) y
`npm run dev` sirve `http://localhost:5178/dev/`, una página de prueba con el índice de Playa y un
webhook de contacto que guarda los envíos en memoria.

## Licencia

MIT
