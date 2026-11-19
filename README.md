# pregunta-al-sitio

Chat flotante que responde preguntas con el contenido de tu sitio. Un buscador corre en el navegador
del visitante: no usa un modelo de lenguaje ni un servidor al responder. Solo en español.

> Estado: motor, CLI, widget y guía de contenido listos. Falta el sitio de ejemplo y publicar el
> paquete en npm.

## Cómo funciona

```
fuentes/ (páginas del sitio, documentos)
   │  un agente las lee siguiendo la guía de contenido
   ▼
contenido/ (nodos/*.md, sitio.yaml, preguntas.yaml)
   │  pregunta-al-sitio build
   ▼
indice.json  +  pregunta-al-sitio.js  →  tu sitio
```

- **Fuentes**: el material de donde sale la información (páginas convertidas a Markdown, PDF,
  presentaciones). Las lees tú o un agente; el chat nunca las usa directamente.
- **Nodos**: cada tema que el chat sabe responder, en un archivo `.md` con un formato propio
  (respuesta corta, preguntas de ejemplo, palabras clave). Los escribe el agente a partir de las fuentes
  y los apruebas tú.
- **Índice**: `indice.json`, el archivo que arma `build` con los nodos aprobados. Es lo único que
  descarga el widget.

## Inicio rápido

Partes con una carpeta de proyecto y las fuentes dentro:

```
mi-sitio/
  fuentes/       páginas convertidas a .md, PDF, textos…
```

**1. Instala el comando** (una vez). Mientras el paquete no esté en npm, desde el repo
`pregunta-al-sitio`:

```bash
npm install && npm run empaquetar && npm link
```

Desde ahí, `pregunta-al-sitio` funciona en cualquier carpeta.

**2. Crea la carpeta de contenido e instala la guía** (dentro de `mi-sitio/`):

```bash
pregunta-al-sitio iniciar contenido --nombre "Mi Sitio"
```

```bash
pregunta-al-sitio skill
```

`iniciar` crea `contenido/` con `sitio.yaml`, los nodos `inicio` y `contacto` y una plantilla de
preguntas. `skill` copia la guía de contenido a `.claude/skills/` para que Claude Code la use.

**3. Pide el contenido al agente.** Abre Claude Code en `mi-sitio/` y escribe:

> Prepara el contenido de pregunta-al-sitio a partir de fuentes/

El agente se detiene tres veces para que revises:

1. El **mapa de nodos**: qué temas tendrá el chat, más los conflictos entre fuentes y los datos que
   faltan (en `contenido/informes/`).
2. El **set de preguntas** con que se mide el chat.
3. El **informe final** con las métricas. Con tu aprobación, marca los nodos como aprobados.

Entre un alto y otro valida, mide y corrige solo.

**4. Arma el índice y copia el widget** a la carpeta pública del sitio:

```bash
pregunta-al-sitio build contenido -o public/indice.json --widget
```

**5. Agrega el script** a las páginas:

```html
<script src="/pregunta-al-sitio.js" data-indice="/indice.json"
        data-contacto-enlace="https://wa.me/56900000000?text={mensaje}" defer></script>
```

Cada vez que cambie el contenido del sitio, actualiza las fuentes, pide al agente que actualice los
nodos y repite el paso 4.

---

## Widget

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

Sin opción de contacto, las consultas sin respuesta muestran solo el nodo `contacto`.

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

## Carpeta de contenido

```
contenido/
  sitio.yaml       nombre, diccionario, ambito, validar y config (esta última la escribe calibrar)
  nodos/*.md       un nodo por archivo
  preguntas.yaml   set de evaluación
  informes/        inventario, mapa de nodos, conflictos y pendientes
```

Un nodo:

```markdown
---
id: hosting
tipo: servicio
titulo: Hosting empresarial
respuesta_corta: >-
  Respuesta de 40 a 60 palabras que el chat muestra. Admite **negrita** y [enlaces](/contacto).
enlace: /hosting                # "Ver más"
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
```

### Enlaces entre nodos

Una respuesta puede abrir otro nodo en el mismo chat: `[Hotel Casona Distante](nodo:casona-distante)`.
`validar` da error si el id no existe o no está en el chat.

Con `autoenlazar: true` en `sitio.yaml`, `build` enlaza solo la primera mención de cada otro nodo en
cada respuesta. Reconoce el título hasta la primera coma, los `alias` y los `sinonimos` marcados con `+`:

```yaml
# sitio.yaml
autoenlazar: true
autoenlazar_max: 5          # autoenlaces por respuesta
# autoenlazar_destino: nodo # o enlace; sin valor, un enlace https abre otra pestaña y el resto abre el nodo

# nodos/casona-distante.md
titulo: Hotel Casona Distante, frente al mar
alias: [la Casona]
sinonimos: [+Casona Distante, hospedaje en la costa]
```

El autoenlace no cambia la búsqueda (mismas métricas en `evaluar`). Con Playa agrega 14 enlaces y el
índice crece un 1,4 % (0,2 KB gzip). Reglas completas en
[`referencia/nodos.md`](guia-contenido/referencia/nodos.md#enlaces-entre-nodos).

El detalle de cada campo, del diccionario, del ámbito y del set de preguntas está en la guía:
[`guia-contenido/`](guia-contenido/SKILL.md).

## Comandos

| Comando | Qué hace |
|---|---|
| `iniciar <carpeta> --nombre "…"` | crea la carpeta de contenido con plantillas; no sobrescribe |
| `skill [carpeta]` | copia la guía a `<carpeta>/.claude/skills/pregunta-al-sitio-contenido` |
| `validar <carpeta>` | revisa los nodos: estructura y reglas de estilo de `sitio.yaml > validar`; sale con 1 si hay errores |
| `build <carpeta> -o <ruta> [--widget]` | arma `indice.json` con los nodos aprobados; `--widget` copia `pregunta-al-sitio.js` al lado |
| `evaluar <carpeta>` | revisa `preguntas.yaml` y mide el chat; muestra los errores de ajuste y de validación |
| `calibrar <carpeta> --escribir` | elige parámetros y umbrales del buscador y los guarda en `sitio.yaml` |

`build`, `evaluar` y `calibrar` aceptan `--borradores` para incluir los nodos sin aprobar. Objetivos de
`evaluar`: top-3 ≥ 90 %, precisión en zona alta ≥ 95 %, fuga de conocimiento general ≤ 3 % y falso
rechazo ≤ 5 %.

## Motor

Para usar el buscador sin el widget:

```js
import { crearResolver } from 'pregunta-al-sitio/motor';

const r = crearResolver(await (await fetch('/indice.json')).json());
r.resolver('¿Tienen hosting?');
// → { zona: 'alta' | 'media' | 'mixta' | 'baja', nodos, ambito, senales, terminos, derivacion, candidatos }
```

`indice.json` trae `version`, `nombre`, `nodos` (con `respuesta` en HTML, `enlace` y `seguimiento`),
`diccionario`, `ambito`, `derivacion` y `config`.

## Desarrollo

Node 20 o superior. `npm install` y `npm test`. El fixture de referencia es Playa SPA
(`tests/fixtures/playa`); después de cambiar sus nodos, `node cli/bin.mjs build tests/fixtures/playa`.

`npm run empaquetar` genera `dist/pregunta-al-sitio.js` (un solo archivo, sin dependencias) y
`npm run dev` sirve `http://localhost:5178/dev/`, una página de prueba con el índice de Playa y un
webhook de contacto que guarda los envíos en memoria.

## Licencia

MIT
