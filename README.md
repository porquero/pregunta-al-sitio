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
pregunta-al-sitio iniciar contenido --nombre "Mi Sitio" --sitio misitio.cl
```

```bash
pregunta-al-sitio skill
```

`iniciar` crea `contenido/` con `sitio.yaml`, los nodos `inicio` y `contacto` y una plantilla de
preguntas. `skill` copia la guía de contenido a `.claude/skills/` para que Claude Code la use.

**3. Pide el contenido al agente.** Abre Claude Code en `mi-sitio/` y escribe:

> Prepara el contenido de pregunta-al-sitio a partir de fuentes/

Primero te pregunta el **rubro y el contexto** del sitio (qué ofrece, a quién, dónde) y elige el tipo
de [schema.org](https://schema.org) que le corresponde (`Hotel`, `Restaurant`, `ProfessionalService`…).
Las propiedades de ese tipo son la pauta de los nodos: así no se le pasan los temas que la gente suele
preguntar en ese rubro (horario de entrada, mascotas, reservas…), y los datos que falten quedan como
pendientes en vez de inventarse. Detalle en
[guia-contenido/referencia/rubros.md](guia-contenido/referencia/rubros.md).

Después se detiene tres veces para que revises:

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
        data-contacto-enlace="https://wa.me/TU-NUMERO?text={mensaje}" defer></script>
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
| `metricas` | `data-metricas` | URL que recibe `{ texto, url, respuesta }` de cada consulta escrita (ver abajo) |
| `textos` | — | reemplaza cualquier texto de la interfaz (ver `src/widget/opciones.js`) |

#### Métricas de consultas (`metricas`)

Con `data-metricas="https://misitio.cl/pas/registrar-consultas.php"`, el widget envía por POST un JSON por
cada consulta que el visitante **escribe** en el cuadro de texto. Los clics en chips, en las opciones de
"¿Te refieres a…?", en las preguntas sugeridas y en los disparadores `data-pregunta-al-sitio` no se envían.

```json
{ "texto": "¿Tienen hosting con respaldo?", "url": "https://misitio.cl/hosting", "respuesta": "Seguridad, respaldo y soporte del hosting" }
```

- `texto`: lo escrito, tal cual, recortado a 300 caracteres.
- `url`: `location.origin + location.pathname`, sin parámetros ni `#`.
- `respuesta`: una frase de lo que respondió el chat, hasta 150 caracteres: el título del nodo mostrado,
  `Opciones: A | B`, `Conocimiento general: A`, `Derivada a contacto` (tema que el sitio deriva a
  propósito) o `Sin respuesta`. Se envía haya respuesta o no; filtrar `Sin respuesta` da el contenido que falta.

No se envía nada más: ni identificador de sesión, ni cookies, ni agente de usuario, ni el texto completo de
la respuesta. El envío usa `navigator.sendBeacon` con un Blob `application/json` y, si no existe o lo
rechaza, `fetch` con `keepalive` y `credentials: 'omit'`. Los errores se ignoran y nunca retrasan la
respuesta. `sendBeacon` no permite omitir credenciales: si la URL es del mismo sitio, el navegador adjunta
sus cookies, que el servidor no debe guardar.

> **Datos personales.** El texto libre puede traer nombres, correos, teléfonos o RUT que la persona
> escribió en el chat. El widget no los filtra: el servidor debe limpiarlos antes de guardar (ocultar
> correos, enlaces, RUT y números largos; recortar el texto) y no guardar IP ni cookies. Informa el
> registro en la política de privacidad del sitio.

El repositorio trae un recolector listo para hosting con PHP 8.1 o superior:
[servidor/recolector/](servidor/recolector/README.md). Guarda un CSV `FECHA;URL;TEXTO;RESPUESTA` (se abre en
Excel), oculta correos, enlaces, RUT y números largos, no guarda IP ni cookies, acepta solo los orígenes
configurados y limita las consultas por hora. La guía incluye la instalación y un texto sugerido para la
política de privacidad.

Haya o no `metricas`, cada consulta escrita dispara en el elemento el evento DOM `pas:consulta` (sube hasta
`document`) con el mismo `{ texto, url, respuesta }` en `detail`, para reenviarlo a otra herramienta de
estadísticas:

```js
document.addEventListener('pas:consulta', (e) => miAnalitica('consulta_chat', e.detail));
```

`metricas` es independiente de `sinRespuesta`, que sigue enviando solo los tokens de las consultas sin
respuesta.

Cuando una consulta no tiene respuesta, el widget muestra el nodo `contacto` con el formulario plegado
tras un botón "Escribir al equipo", la invitación a seguir preguntando y los temas de la bienvenida (chips
del nodo de tipo `saludo`) que aún no se vieron. Así la conversación no parece terminada. Si la persona
pide escribir al equipo, el formulario aparece abierto. Sin opción de contacto, se muestra solo el nodo
`contacto` y la invitación a seguir. Si el enlace de contacto conserva el número de ejemplo
(`TU-NUMERO`), el widget lo avisa en la consola del navegador.

Si el nodo tiene `enlace`, la respuesta termina con un botón "Ver más sobre {titulo}": es el paso más
directo para ampliar la respuesta, así que se destaca sobre los chips, que van después bajo "Sigue
preguntando". Los textos se cambian con `textos.verMas` (admite `{titulo}`), `textos.sigue` y
`textos.seguirPreguntando`.

Los chips de seguimiento no repiten nodos que la persona ya vio en la conversación: si un nodo no declara
`chips`, se completan con los destinos de sus otras aristas, y el nodo anterior solo vuelve si no queda
otra opción.

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
  sitio.yaml       nombre, sitio (dominio), diccionario, ambito, validar y config
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
schema: { tipo: Service, propiedades: [serviceType, offers] }   # opcional: qué datos de schema.org cubre
---
```

`sitio.yaml`, con las claves principales (`iniciar` crea la plantilla con `config: {}`; todo lo omitido usa los valores por defecto):

```yaml
nombre: Mi Sitio
sitio: misitio.cl                 # el chat solo enlaza a este dominio y sus subdominios

diccionario:                      # variante → forma canónica
  wsp: whatsapp
  cuanto cuesta: precio

ambito:
  marcas: [mi sitio, misitio, nombre-de-producto]   # productos y temas propios ("BPM")
  genericas: [que es, como funciona, que hora es]   # cultura general: va a contacto
  derivar: [busco empleo, precio sistema]           # temas que el chat no responde
  excluir_si: [clima, horoscopo]                    # temas ajenos: sin marca, la consulta es general

vocabulario:
  ignorar: [debera, anexo]        # palabras frecuentes de las fuentes que no necesitan nodo

config:
  # Los escribe `calibrar --escribir`:
  motor: { k1: 1.6, pesos: { titulo: 2, preguntas: 1.5, keywords: 3, sinonimos: 2 }, similitudMin: 0.5, frase: 0.5, tfLog: [] }
  zonas: { Ta: 0.5, Ca: 0.5, Ma: 0, Tm: 0.3, Cm: 0.2 }
  normaPorTerminos: true          # consultas de una o dos palabras con escala proporcional
  # Los escribes tú; calibrar los conserva:
  opcionesMedia: 2                # opciones en "¿Te refieres a A o B?"
  tipos:                          # prioridad por tipo de nodo (ver abajo)
    articulo: { peso: 0.8 }
  empate: 0.05                    # diferencia bajo la cual gana el tipo de mayor peso
```

`marcas`, `oferta`, `necesidad` y `genericas` se comparan como frases, sin aplicar el diccionario.
`derivar` y `excluir_si` además se comparan por términos con el diccionario aplicado: con
`cuanto cuesta: precio`, la entrada `precio sistema` también detecta "¿cuánto cuesta un sistema?". Detalle
en [guia-contenido/referencia/ambito-y-diccionario.md](guia-contenido/referencia/ambito-y-diccionario.md).

### Prioridad por tipo de nodo

Si el sitio tiene nodos de **oferta** (servicios, productos) y de **contenido** (artículos, novedades,
tutoriales), declara la prioridad en `sitio.yaml > config`:

```yaml
config:
  tipos:
    articulo: { peso: 0.8 }      # el contenido compite con el 80 % de su puntaje
    novedad: { peso: 0.8 }
    videotutorial: { peso: 0.8 }
  opcionesMedia: 2               # opciones en "¿Te refieres a A o B?"
```

- `peso` (0 a 1,5) multiplica el puntaje del nodo antes de calcular la zona, el margen y el orden. Los
  tipos no listados valen 1. `evaluar` y `calibrar` usan el mismo cálculo.
- Entre dos candidatos que difieren en menos del 5 % (`config.empate`), va primero el tipo de mayor peso,
  en "¿Te refieres a…?" y en los chips de seguimiento.
- `respaldo: true` (`articulo: { respaldo: true }`) es más estricto: el nodo solo compite si sin él la
  consulta cae en zona baja (segunda vuelta), y nunca se ofrece junto a una opción de la oferta.
- Sin `tipos`, el motor se comporta como antes.

Con Playa SPA (91 nodos, 30 de contenido), `peso: 0.8` mejoró todas las métricas de validación, y
`respaldo` bajó el top-3 de 89 % a 80 % porque las consultas que sí buscaban un artículo pasaban a
ofrecer servicios. Empieza con `peso`; usa `respaldo` solo para contenido que nunca debe competir.

### Solo enlaces del sitio

El chat no debe sacar al visitante del sitio. `sitio` en `sitio.yaml` es el dominio principal
(`sitio: misitio.cl`; acepta `https://www.misitio.cl`, `*misitio.cl*` o una lista). Al armar el
índice, `build` deja en las respuestas solo los enlaces a ese dominio o a sus subdominios, con
cualquier ruta, más las rutas relativas, `mailto:` y `tel:`. El resto se omite: un `[texto](url)`
queda como texto y el "Ver más", el botón de la tarjeta o el enlace de un ítem desaparecen. `build`
informa cuántos enlaces omitió y `validar` los lista. Sin `sitio`, `build` y `validar` usan el dominio
más frecuente en los `enlace` de los nodos y lo avisan; si no hay URL absolutas, solo quedan las rutas
relativas.

### Documento local (`sitio: localhost`)

Para un documento sin sitio web propio (un manual, una norma, un informe), escribe `sitio: localhost`
(o `127.0.0.1`). `build` arma el índice como siempre y escribe además `index.html` junto a él:

- la cabecera lleva el título, una bajada (`documento.descripcion`, o si falta `descripcion` o
  `rubro.descripcion` de `sitio.yaml`), cuántas secciones y grupos hay, un botón "Hacer una pregunta"
  que abre el chat y hasta cuatro preguntas de ejemplo que se envían al chat al hacer clic. Una sección
  "Presentación" opcional abre el contenido;
- la página tiene un menú lateral fijo con buscador (por título y keywords; en el celular, un botón lo
  despliega) que marca la sección a la vista, y las secciones agrupadas por `tipo` de nodo;
- cada nodo aprobado es una tarjeta (`<section id="id-del-nodo">`) con antetítulo (grupo y número),
  título, la respuesta corta, el cuerpo en Markdown (títulos, listas, tablas, citas, código e imágenes),
  el `texto_original` plegado bajo el botón "Texto original" y la `fuente` del nodo. `texto_original` es
  el texto de la fuente del que sale la respuesta, sin resumir: así la página no repite el chat y
  permite contrastar la respuesta con el documento. Sin `texto_original`, un cuerpo de más de 120
  palabras es el que se pliega. El saludo no lleva sección;
- el chat va dentro: "Ver más" lleva a la sección del nodo y los enlaces de las respuestas que apuntan
  al `enlace` de otro nodo pasan a ser `#id`. Se reconoce la ruta con su fragmento, así que varios nodos
  pueden estar en la misma página (`/rca#cierre`, `/rca#fauna`), y también sin `.html` o con host
  (`/plazos.html`, `http://localhost:3000/plazos`). Un nodo sin `enlace` pero con cuerpo también recibe
  "Ver más" hacia su sección. Al llegar a una sección, su cuerpo plegado se abre. En el
  celular, donde el chat ocupa toda la pantalla, seguir uno de esos enlaces cierra el chat para mostrar
  la sección;
- el índice y el script van incrustados, así que el archivo funciona abierto directamente, sin servidor.

Los textos de la página se ajustan en `sitio.yaml` (todo es opcional):

```yaml
documento:
  antetitulo: Resolución de Calificación Ambiental     # línea sobre el título
  titulo: Continuidad Operacional en Distrito Pleito   # por defecto, nombre
  descripcion: Contenido de la resolución organizado por secciones.   # bajada del título
  presentacion: |               # Markdown de la sección "Presentación", al comienzo
    Esta página reúne la resolución del proyecto, organizada por temas.
  preguntas:                    # ejemplos bajo el título; por defecto, una pregunta por grupo; [] los quita
    - ¿Qué pasa al terminar el proyecto?
  grupos:                       # nombre y orden de los grupos por tipo; los demás tipos van después
    proyecto: El proyecto
    impacto: Impactos evaluados
  detalle: Texto de la resolución   # botón de lo plegado (por defecto "Texto original")
  pie: Texto basado en la resolución original.   # por defecto, nombre
```

`build` solo reemplaza un `index.html` que él mismo generó; si en la carpeta de salida hay otro, falla
sin escribir nada y pide otra `--salida`.

### Enlaces entre nodos

Una respuesta puede abrir otro nodo en el mismo chat: `[Hotel Casona Distante](nodo:casona-distante)`.
`validar` da error si el id no existe o no está en el chat.

Con `autoenlazar: true` en `sitio.yaml`, `build` enlaza solo la primera mención de cada otro nodo en
cada respuesta. Reconoce el título hasta la primera coma, los `alias` y los `sinonimos` marcados con `+`:

```yaml
# sitio.yaml
autoenlazar: true
autoenlazar_max: 5          # autoenlaces por respuesta
# autoenlazar_destino: enlace # usa el "enlace" del nodo si es del sitio; por defecto abre el nodo en el chat

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
| `iniciar <carpeta> --nombre "…" --sitio <dominio>` | crea la carpeta de contenido con plantillas; no sobrescribe |
| `skill [carpeta]` | copia la guía a `<carpeta>/.claude/skills/pregunta-al-sitio-contenido` |
| `validar <carpeta>` | revisa los nodos: estructura y reglas de estilo de `sitio.yaml > validar`; sale con 1 si hay errores |
| `build <carpeta> -o <ruta> [--widget]` | arma `indice.json` con los nodos aprobados e informa los enlaces omitidos; `--widget` copia `pregunta-al-sitio.js` al lado (en el repo lo empaqueta antes; instalado, falla si `dist/` está viejo). Con `sitio: localhost` escribe además `index.html`, el documento navegable con el chat dentro |
| `evaluar <carpeta>` | revisa `preguntas.yaml` y mide el chat: métricas con intervalo de confianza (Wilson 95 %), por familia (oferta y contenido) si hay `config.tipos`, y errores de ajuste y de validación |
| `calibrar <carpeta> --escribir [--max-falso-rechazo 5%]` | elige parámetros y umbrales del buscador y los guarda en `sitio.yaml` (conserva `tipos` y `opcionesMedia`); muestra el compromiso entre falso rechazo y fuga por umbral y cuántos títulos y keywords sueltos terminan en contacto |
| `cobertura <carpeta> --fuentes <fuentes> [--normalizar]` | lista las fuentes con línea `URL:` sin un nodo cuyo `enlace` sea esa URL; sale con 1 si hay. `--normalizar` ignora `.html` e `index.html` |
| `vocabulario <carpeta> --fuentes <fuentes> [--min 5] [--largo 5]` | cuenta las palabras de las fuentes y lista las frecuentes que, escritas solas, terminan en contacto ("evento", "caudal"); sale con 1 si hay. Las administrativas se declaran en `sitio.yaml > vocabulario.ignorar` |

`build`, `evaluar` y `calibrar` aceptan `--borradores` para incluir los nodos sin aprobar. Objetivos de
`evaluar`: top-3 ≥ 90 %, precisión en zona alta ≥ 95 %, fuga de conocimiento general ≤ 3 % y falso
rechazo ≤ 5 %. Las consultas de tipo `seguimiento` no entran en las métricas (el chat responde sin el
contexto de la conversación); `evaluar` informa su acierto aparte.

`evaluar` y `calibrar` avisan si la validación tiene menos de 100 consultas (con 85, un error mueve el
top-3 más de un punto) y si el top-3 de ajuste supera al de validación en más de 8 puntos: probable
sobreajuste del contenido al set. `evaluar` avisa también si menos del 10 % de las consultas tienen una o
dos palabras ("servicios", "precio hosting").

`calibrar` prueba además dos opciones del motor y deja la que mide mejor:

- `config.normaPorTerminos`: una consulta de una o dos palabras se compara con una escala proporcional a
  su largo. Sin esto, "servicios" o "hosting" podían ir a contacto aunque el primer candidato fuera el
  correcto.
- `config.motor.tfLog: [preguntas]`: un término repetido en muchas preguntas de un nodo suma menos.

**Regla de cobertura: una fuente con `URL:` es un nodo.** Cada archivo de `fuentes/` con una línea
`URL: https://…` es una página publicada y lleva al menos un nodo con `enlace` igual a esa URL (una ruta
relativa vale si la URL es del dominio de `sitio`). Las excepciones, duplicados exactos o páginas que se
decidió no cubrir, van en `sitio.yaml`:

```yaml
cobertura:
  excluir: [https://misitio.cl/tours-copia]
```

## Buenas prácticas de contenido

Aprendidas al construir un sitio real (91 nodos, 248 consultas):

1. Incluye en el set consultas de una y dos palabras: "servicios", "hosting", "precios".
2. No copies la `respuesta_corta` en las `preguntas`, ni repitas el nombre del producto en todas:
   `validar` avisa cuando más del 60 % de las preguntas de un nodo repiten el tema de otro.
3. Si hay nodos de contenido (artículos, novedades), declara su tipo y su prioridad (`config.tipos`) desde
   el inicio. Dales pocas keywords, sin sinónimos, y no repitas el vocabulario de los servicios.
4. Los nombres de producto y los temas propios del sitio ("BPM") van en `ambito.marcas`; si no, "¿qué es
   X?" se trata como cultura general.
5. Construye primero con `--borradores` para probar el widget; aprueba y reconstruye sin ellos.
6. Evita aristas recíprocas y nodos con una sola arista saliente. Al limpiar, conserva la arista del
   nodo "padre" (resumen → detalle).
7. Las preguntas "fuera" (precios no publicados, registro de dominios) se resuelven con `ambito.derivar`,
   no con nodos.

Para convertir un sitio descargado con wget a fuentes, la guía trae
`guia-contenido/herramientas/convertir.sh`.

## Motor

Para usar el buscador sin el widget:

```js
import { crearResolver } from 'pregunta-al-sitio/motor';

const r = crearResolver(await (await fetch('/indice.json')).json());
r.resolver('¿Tienen hosting?');
// → { zona: 'alta' | 'media' | 'mixta' | 'baja', nodos, ambito, senales, vuelta, terminos, derivacion, candidatos, orden }
```

`indice.json` trae `version`, `nombre`, `nodos` (con `respuesta` en HTML, `enlace` y `seguimiento`),
`diccionario`, `ambito`, `derivacion` y `config` (`motor`, `zonas`, `opcionesMedia`, `tipos`, `empate`,
`normaPorTerminos`). Un `indice.json` anterior sin esas claves funciona igual que antes.

## Desarrollo

Node 20 o superior. `npm install` y `npm test`. El fixture de referencia es Playa SPA
(`tests/fixtures/playa`); después de cambiar sus nodos, `node cli/bin.mjs build tests/fixtures/playa`.

`npm run empaquetar` genera `dist/pregunta-al-sitio.js` (un solo archivo, sin dependencias); un test
compara ese archivo con una compilación nueva de `src/` y falla si quedó viejo. `npm run dev` sirve `http://localhost:5178/dev/`, una página de prueba con el índice de Playa y un
webhook de contacto que guarda los envíos en memoria.

## Licencia

MIT
