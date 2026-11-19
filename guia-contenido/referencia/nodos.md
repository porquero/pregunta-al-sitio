# Nodos

Un nodo es un tema que el chat responde. Cada archivo `nodos/<id>.md` tiene frontmatter YAML entre
líneas `---` y un cuerpo Markdown opcional (el chat no lo muestra; sirve de respaldo o para una página).

```markdown
---
id: hosting
tipo: servicio
titulo: Hosting empresarial, con respaldo diario
enlace: /hosting
formato: tarjeta
variante: servicio
respuesta_corta: >-
  En Acme ofrecemos hosting para pymes con certificados SSL automáticos, respaldo diario guardado
  fuera del servidor y soporte por WhatsApp con el equipo técnico. Migramos tu sitio sin costo y te
  acompañamos en la configuración del correo con tu dominio.
tarjeta:
  eyebrow: Servicio
  items: [SSL automático, Respaldo diario externo, Soporte por WhatsApp]
  etiquetas: [cPanel, PHP 8, MySQL]
  cta: { texto: Cotizar hosting, destino: /contacto }
preguntas:
  - ¿Tienen hosting?
  - ¿Me pueden alojar la página de mi empresa?
  - ¿El hosting trae certificado SSL?
  - ¿Hacen respaldos del sitio?
  - ¿Me migran el sitio desde otro proveedor?
  - ¿Sirve para WordPress?
  - ¿Incluye correo con mi dominio?
  - ¿Cómo es el soporte si se cae la página?
keywords: [hosting, alojamiento, ssl, respaldo, wordpress, migracion, servidor, dominio]
sinonimos: [hospedaje, servidor web, plan de hosting, correo corporativo]
aristas:
  - { a: respaldos, tipo: profundiza, peso: 0.9 }
  - { a: contacto, tipo: cta, peso: 0.7 }
chips: [¿Cada cuánto hacen respaldos?, { texto: Cotizar, a: contacto }]
estado: borrador
---
```

## Campos

| Campo | Obligatorio | Uso |
|---|---|---|
| `id` | sí | minúsculas, números y guiones; igual al nombre del archivo |
| `tipo` | sí | categoría libre (`servicio`, `producto`, `faq`, `proceso`…). Dos tienen efecto: `saludo` es la bienvenida del chat y no se ofrece en "¿Te refieres a A o B?"; el nodo con id `contacto` recibe las consultas sin respuesta |
| `titulo` | sí | nombre del tema. Lo antes de la primera coma se usa en chips y en "¿Te refieres a…?", así que empieza por el nombre corto |
| `respuesta_corta` | sí | lo que el chat muestra. 40 a 60 palabras |
| `enlace` | no | destino de "Ver más": ruta del sitio (`/hosting`, `/servicios#hosting`) o URL `https://` del dominio de `sitio`. Otro dominio se omite |
| `formato` | no | `texto` (por defecto) o `tarjeta` |
| `variante` | con tarjeta | `servicio`, `producto`, `proceso` (items numerados), `cifras`, `caso`… |
| `tarjeta` | no | `eyebrow`, `titulo`, `items` (textos u objetos `{titulo, texto, ruta}`), `cifras` (`{numero, etiqueta}`), `etiquetas`, `cta` (`{texto, destino}`) |
| `preguntas` | sí | 8 a 12 formulaciones de visitante (mínimo 6) |
| `keywords` | sí | términos que identifican el tema |
| `sinonimos` | no | otras formas de nombrar el tema, propias de este nodo. Con `+` delante (`+Casona`) también es un nombre enlazable |
| `alias` | no | nombres enlazables que no son sinónimos de búsqueda (ver [Enlaces entre nodos](#enlaces-entre-nodos)) |
| `autoenlazar` | no | `false` excluye el nodo del autoenlace: sus nombres no se enlazan en otras respuestas |
| `aristas` | no | relaciones con otros nodos: `{a, tipo, peso}` |
| `chips` | no | sugerencias después de la respuesta: texto (se pregunta al chat) o `{texto, a}` (abre el nodo `a`). Sin chips, el widget ofrece los destinos de las tres aristas de mayor peso |
| `publicacion` | no | `{ chat: false }` deja el nodo fuera del chat |
| `derivacion` | en contacto | texto que precede al contacto cuando la consulta no tiene respuesta |
| `estado` | sí | `borrador` o `aprobado`; `build` publica solo los aprobados |
| `fuente` | recomendado | archivo y sección de donde sale el texto |
| `schema` | recomendado | `{ tipo, propiedades }` de schema.org que cubre el nodo (`{ tipo: Hotel, propiedades: [checkinTime, checkoutTime] }`). El chat no lo usa; sirve para revisar la cobertura del rubro. Ver [rubros.md](rubros.md) |

## Tarjeta: claves admitidas

`validar` da error si un objeto de la tarjeta trae otra clave o una clave sin valor:

| Lugar | Claves |
|---|---|
| `tarjeta.items[*]` (cuando son objetos) | `titulo`, `texto`, `ruta` |
| `tarjeta.cifras[*]` | `numero`, `etiqueta` |
| `tarjeta.cta` | `texto`, `destino` |

En YAML, una coma o dos puntos dentro de `{ … }` parten el valor: `{ titulo: Duración, texto: 2,5 horas }`
se lee como texto `2` y una clave `5 horas` sin valor. Entrecomilla esos valores:
`{ titulo: Duración, texto: "2,5 horas" }`.

## Cómo dividir en nodos

- Un nodo responde una pregunta que un visitante haría por separado. "Horario" y "teléfono" pueden ir
  juntos en `contacto`; "hosting" y "desarrollo de software" van separados.
- Si un nodo necesita más de 60 palabras para responder bien, son dos nodos: un resumen y un detalle
  unidos por `profundiza`.
- Dos nodos con las mismas keywords compiten entre sí y el chat termina preguntando "¿Te refieres a A
  o B?". Diferéncialos en el título, las keywords y las preguntas, o fusiónalos.
- Preguntas que el sitio decide no responder (precios no publicados, por ejemplo) no llevan nodo: el
  set de evaluación las espera en `contacto`.

## Redacción de `respuesta_corta`

- Copia el texto de la fuente con ajustes mínimos. No inventes datos, cifras ni promesas.
- Nombra al sitio (`En Acme ofrecemos…`): ayuda al visitante y a buscadores y asistentes que citan el sitio.
  `validar` avisa si falta (`validar.respuesta.nombrar` en `sitio.yaml`).
- Responde la pregunta en la primera frase. Lo demás, en orden de importancia.
- Usa el tono del sitio. Sin exclamaciones, superlativos ni relleno comercial.
- Admite Markdown en línea: `**negrita**`, `*cursiva*`, `[enlace](/ruta)` y `[texto](nodo:id)`.
- Lo que falte: `[REDACTAR qué falta]` y `estado: borrador`.

## Solo enlaces del sitio

El visitante debe quedarse en el sitio. En la respuesta, el "Ver más", la tarjeta y los ítems, usa
rutas del sitio (`/hosting`) o URL del dominio de `sitio` en `sitio.yaml` (y sus subdominios).
`build` omite cualquier enlace a otro dominio: queda el texto, sin enlace. Si la fuente remite a
otro sitio (una plataforma asociada, un producto con dominio propio), no lo enlaces: nombra el sitio
en el texto o déjalo en el cuerpo del nodo, que el chat no muestra. `validar` avisa cada enlace que
se omitirá: corrígelo en vez de dejarlo.

## Enlaces entre nodos

Cuando una respuesta menciona otro tema del chat, la mención puede abrir ese nodo en el mismo chat,
sin salir de la página.

**A mano**, con `nodo:` como destino:

```yaml
respuesta_corta: >-
  En Acme alojamos a los huéspedes del [Hotel Casona Distante](nodo:casona-distante) y del
  [Refugio Norte](nodo:refugio-norte), con traslado desde el aeropuerto incluido.
```

`validar` da error si el id no existe, si el nodo no está en el chat (`publicacion.chat: false`) o si
es el mismo nodo. El largo de 40 a 60 palabras cuenta solo el texto visible del enlace.

**Automático**, con `autoenlazar: true` en `sitio.yaml` (por defecto está apagado). En cada respuesta,
`build` enlaza la **primera** mención de cada otro nodo. Un nodo se reconoce por:

- su `titulo` hasta la primera coma (`Hotel Casona Distante, frente al mar` → `Hotel Casona Distante`),
- sus `alias`,
- sus `sinonimos` con `+` delante. El `+` solo marca el nombre como enlazable; el buscador usa el
  sinónimo sin él.

```yaml
# nodos/casona-distante.md
titulo: Hotel Casona Distante, frente al mar
alias: [la Casona]
sinonimos: [+Casona Distante, hospedaje en la costa]
```

Reglas: palabras completas, sin distinguir mayúsculas ni tildes; el nodo no se enlaza a sí mismo; el
texto dentro de un enlace, `**negrita**`, `*cursiva*` o `` `código` `` no se toca; ante nombres
solapados gana el más largo, y hay un máximo de autoenlaces por respuesta.

| Clave de `sitio.yaml` | Por defecto | Uso |
|---|---|---|
| `autoenlazar` | `false` | enciende el autoenlace |
| `autoenlazar_max` | `5` | autoenlaces por respuesta |
| `autoenlazar_destino` | `nodo` | `nodo` abre el nodo en el chat; `enlace` usa el `enlace` del nodo si es del sitio y, si no, deja la mención como texto (`validar` avisa esos nodos) |

Con `autoenlazar: true`, `validar` avisa los nombres enlazables que enlazarían de más: una sola palabra
común (una palabra vacía del buscador o una que usan 3 o más respuestas) o un nombre que aparece en las
respuestas de más de 10 nodos. Para excluir un nodo, `autoenlazar: false` en su frontmatter.

Cuidado con los títulos que empiezan por una palabra común: `Seguridad, respaldo y soporte` se
reconoce como "Seguridad" y enlazaría cualquier mención de seguridad. Reescribe la parte antes de la
coma (`Seguridad del hosting, respaldo y soporte`) o deja el autoenlace apagado y usa enlaces a mano.
Después de `build`, revisa qué se enlazó. El autoenlace no cambia la búsqueda: `evaluar` da las mismas métricas.

## Preguntas, keywords y sinónimos

Son lo que el buscador compara con la consulta. Pesan más `keywords`, luego `titulo` y `sinonimos`, y
luego `preguntas`.

- **preguntas**: como las escribe alguien que no conoce el sitio. Mezcla formales y coloquiales,
  cortas y largas, con la jerga del país (`¿cuánto sale?`, `¿me pueden ayudar con…?`). Cubre las
  distintas intenciones del tema: qué es, si lo tienen, cómo funciona, plazos, requisitos.
- **keywords**: 5 a 10 términos del tema, incluidas siglas y nombres de producto. Evita palabras que
  aparecen en todos los nodos (`empresa`, `servicio`).
- **sinonimos** del nodo: cómo nombraría el tema alguien de afuera. Si un sinónimo vale para todo el
  sitio (`wsp` → `whatsapp`), va al `diccionario` de `sitio.yaml`.

## Aristas

| Tipo | Uso | Peso típico |
|---|---|---|
| `profundiza` | resumen → detalle | 0,8 a 0,9 |
| `prueba` | servicio → caso o producto que lo respalda | 0,6 a 0,8 |
| `proceso` | servicio → forma de trabajo | 0,5 a 0,7 |
| `cta` | → contacto | 0,5 a 0,7 |

El peso va de 0,3 a 1,0 y ordena los chips de seguimiento. Cada nodo debería tener al menos una arista
para que la conversación pueda seguir.
