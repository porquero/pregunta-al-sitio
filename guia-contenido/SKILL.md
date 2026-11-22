---
name: pregunta-al-sitio-contenido
description: Genera y mejora el contenido del chat "pregunta-al-sitio" de un sitio (nodos, diccionario de sinónimos, reglas de ámbito, aristas y set de preguntas de evaluación) a partir del sitio publicado o de su documentación, y lo ajusta hasta cumplir las métricas. Úsala cuando pidan preparar, ampliar o corregir el contenido de pregunta-al-sitio, crear sus nodos o su preguntas.yaml, o subir sus métricas.
---

# Contenido para pregunta-al-sitio

El chat responde solo con lo que está en los nodos: un buscador en el navegador elige el nodo y muestra
su respuesta. No hay un modelo de lenguaje al responder, así que la calidad depende de tres cosas que
preparas tú: qué nodos existen, con qué palabras los buscaría un visitante y qué consultas deben ir a
contacto.

Trabajas sobre una carpeta de contenido (en este documento, `contenido/`):

```
contenido/
  sitio.yaml       nombre, sitio (dominio), diccionario, ambito, validar y config (esta última la escribe calibrar)
  nodos/*.md       un nodo por archivo
  preguntas.yaml   set de evaluación
  informes/        inventario, mapa de nodos, conflictos y pendientes (para la revisión humana)
```

**Fuentes y nodos son cosas distintas.** Las fuentes (páginas del sitio convertidas a Markdown, PDF,
textos) están en `fuentes/` o donde la persona indique; son material de lectura y no se tocan. Los
nodos los escribes tú en `contenido/nodos/`, con el formato de [referencia/nodos.md](referencia/nodos.md):
un archivo de fuente puede dar varios nodos, y un nodo puede juntar datos de varias fuentes.

Comandos (si `pregunta-al-sitio` no responde, prueba con `npx pregunta-al-sitio …`):

```bash
pregunta-al-sitio iniciar contenido --nombre "Nombre del sitio" --sitio dominio.cl
pregunta-al-sitio validar contenido
pregunta-al-sitio evaluar contenido [--borradores]
pregunta-al-sitio calibrar contenido --escribir [--borradores] [--max-falso-rechazo 5%]
pregunta-al-sitio cobertura contenido --fuentes fuentes [--normalizar]
pregunta-al-sitio vocabulario contenido --fuentes fuentes [--min 5]
pregunta-al-sitio build contenido -o public/indice.json --widget
```

## Proceso

Sigue las etapas en orden. Las marcadas con **Alto** terminan esperando la revisión de la persona: no
avances sin su respuesta.

### 1. Rubro, fuentes e inventario

1. **Pregunta el rubro y el contexto** del sitio: qué es el negocio, qué ofrece, a quién y dónde. Si las
   fuentes ya lo muestran, propón tú la respuesta y pide que la confirme. Con eso elige el tipo de
   [schema.org](https://schema.org) que corresponde (`Hotel`, `Restaurant`, `ProfessionalService`…) y
   anótalo en `sitio.yaml > rubro`. Sus propiedades son la pauta de los nodos. Detalle en
   [referencia/rubros.md](referencia/rubros.md). No avances sin la respuesta.
2. Junta las fuentes. Si te dan un sitio descargado con wget, conviértelo con
   [herramientas/convertir.sh](herramientas/convertir.sh), que deja la línea `URL:` tal como la publica el
   sitio (sin `.html`). Junta lo que haya en `fuentes/` (o la carpeta que te indiquen), el sitio publicado si
   te dan su URL (cada página relevante, incluido el pie y las páginas legales), documentos (PDF,
   presentaciones, textos) y preguntas reales de clientes si existen. No modifiques las fuentes. Si no
   hay ninguna, pregunta de dónde sacarlas antes de seguir. Si la fuente es un documento sin sitio web
   (manual, norma, informe), escribe `sitio: localhost`: `build` genera además `index.html` con cada nodo
   como sección, menú con buscador y el chat dentro. Entonces el cuerpo del nodo es el texto de la
   sección (Markdown), `fuente` se muestra al pie de cada sección, `texto_original` guarda el texto de la
   fuente del que sacaste `respuesta_corta` (cópialo sin resumir ni corregir; la página lo muestra plegado
   para contrastar) y `enlace: /documento#id` hace que los
   enlaces entre secciones lleven a ella. Ajusta cabecera, nombres de grupo (por `tipo`) y pie en
   `sitio.yaml > documento` (detalle en el README, "Documento local"); no escribas el HTML a mano.
3. Si no existe la carpeta, créala con `iniciar`.
4. Escribe `informes/inventario.md`: una fila por fuente con tipo, tema, secciones útiles y
   observaciones. Marca las fuentes que tengan una línea `URL:`.

**Regla fija: una fuente con `URL:` es un nodo.** Todo `.md` de fuente que traiga una línea `URL:` es una
página publicada y tiene al menos un nodo propio, con `enlace` igual a esa URL. Da igual si la página es
una portada, una categoría, una ficha de empresa, un artículo de blog o una página de noticias. Un mismo
archivo puede dar además otros nodos (resumen y detalle, secciones que se preguntan por separado). Solo hay
dos excepciones, y ambas se escriben en el inventario con su motivo: el duplicado exacto de otra fuente
(misma página bajo otra URL) y la página que la persona pida excluir. Las páginas de navegación, listados
o noticias también llevan nodo: si no tienen datos propios, el nodo orienta (qué hay allí y cómo llegar) y no
repite los listados.

### 2. Mapa de nodos — Alto

Escribe `informes/mapa-de-nodos.md` con una tabla: id, tipo, título, enlace, formato, schema (tipo y
propiedades que cubre), fuente (archivo y sección), aristas previstas y estado. Criterios en
[referencia/nodos.md](referencia/nodos.md) y [referencia/rubros.md](referencia/rubros.md).

- Un nodo por tema que un visitante preguntaría por separado. Un sitio pequeño suele quedar con 10 a 20
  nodos; uno de servicios, con 25 a 40.
- Siempre: `inicio` (tipo `saludo`) y `contacto`.
- Siempre: un nodo por cada fuente con `URL:` (regla de la etapa 1). Antes de pedir la revisión, cruza la
  columna `enlace` del mapa con las URL de las fuentes. Toda fuente sin nodo se lista en el mapa, en una
  sección "Fuentes sin nodo" con el motivo permitido (duplicado exacto o exclusión pedida); al escribir los
  nodos, esas URL van a `sitio.yaml > cobertura.excluir`.
- Recorre las propiedades del tipo de schema.org del rubro: agrupa en un nodo las que se preguntan
  juntas (ubicación, horario, pagos, políticas) y da un nodo a cada oferta concreta (habitación, tour,
  servicio, producto). Al final del mapa, lista las propiedades frecuentes que ningún nodo cubre y por qué.
  Los datos que faltan van a `informes/pendientes.md`, nunca inventados.
- Si el sitio tiene **contenido** además de la oferta (artículos, novedades, tutoriales), dale un `tipo`
  propio desde el mapa (`articulo`, `novedad`, `videotutorial`) y propón su prioridad en
  `sitio.yaml > config.tipos` (`{ peso: 0.8 }`): la oferta debe ganar cuando coincide. Ver
  [referencia/nodos.md](referencia/nodos.md#prioridad-por-tipo).
- Aristas: evita las recíprocas y los nodos con una sola arista saliente. Si dos nodos se apuntan entre
  sí, conserva la del "padre" (resumen → detalle).
- Si una fuente profundiza un tema, propón dos nodos (resumen y detalle) unidos por una arista
  `profundiza`.

Además:

- `informes/conflictos.md`: contradicciones entre fuentes (cifras, fechas, nombres). Presenta las
  alternativas con su fuente y no elijas por tu cuenta.
- `informes/pendientes.md`: lo que parezca interno o sensible (precios no publicados, nombres de
  clientes, datos personales, contratos) y los datos que faltan. Nada de eso se publica sin aprobación.

Detente y pide revisión del mapa, los conflictos y los pendientes.

### 3. Nodos

Con el mapa aprobado, escribe un archivo por nodo en `nodos/`. Reglas de campos y redacción en
[referencia/nodos.md](referencia/nodos.md). Lo esencial:

- `respuesta_corta` de 40 a 60 palabras, copiada de la fuente con ajustes mínimos; nombra al sitio.
- 8 a 12 `preguntas` escritas como las escribiría un visitante, con su jerga.
- `keywords` y `sinonimos` con las palabras que usaría alguien que no conoce los nombres internos.
- No copies la `respuesta_corta` en las `preguntas` ni repitas el nombre del producto en todas: el nodo
  sumaría de más y le ganaría al principal de ese tema.
- Los artículos genéricos llevan pocas keywords (2 o 3), sin sinónimos, y sin el vocabulario de los
  servicios.
  Las propiedades de schema.org ordenan los nodos, pero no son palabras de visitante: van solo en el campo
  `schema`.
- Un dato que falta se marca `[REDACTAR …]` y el nodo queda en `estado: borrador`.
- Todo nodo nace en `borrador`; lo aprueba la persona.

Corre `validar` hasta que no queden errores y `pregunta-al-sitio cobertura contenido --fuentes fuentes`
hasta que salga sin fuentes sin nodo (código 0). Revisa también los avisos de `validar` sobre aristas
(recíprocas, una sola saliente, nodos que reciben aristas de más del 15 % de los nodos) y, si el sitio usa
`autoenlazar`, sobre nombres enlazables comunes.

Corre también `pregunta-al-sitio vocabulario contenido --fuentes fuentes`: lista las palabras que las
fuentes repiten (5 veces o más) y que, escritas solas, el chat manda a contacto. Un visitante usa el
vocabulario del documento, así que una palabra frecuente sin respuesta delata un tema sin nodo o sin
keywords. Para cada una: agrégala a `keywords` o `sinonimos` del nodo que la trata, crea un nodo si el
tema falta, o anótala en `sitio.yaml > vocabulario.ignorar` si es administrativa ("deberá", "anexo").

### 4. Diccionario y ámbito

En `sitio.yaml` (detalle en [referencia/ambito-y-diccionario.md](referencia/ambito-y-diccionario.md)):

- `diccionario`: variantes y jerga que el visitante escribe distinto del sitio (`wsp: whatsapp`,
  `excel: planilla`, `cuanto cuesta: precio`).
- `ambito.marcas`: el nombre del sitio, sus marcas y productos, y los temas propios que el sitio explica
  ("BPM"): sin marca, "¿qué es BPM?" se trata como cultura general.
- `ambito.derivar`: temas que el chat no responde aunque haya palabras parecidas (empleo, precios no
  publicados, registro de dominios). Las preguntas "fuera" se resuelven aquí, no con nodos.
- Revisa `oferta`, `necesidad` y `genericas`, que `iniciar` deja con valores genéricos.

### 5. Set de evaluación — Alto

Escribe `preguntas.yaml` con al menos 150 consultas, al menos el 10 % de una o dos palabras ("servicios",
"hosting", "precios"), según
[referencia/preguntas.md](referencia/preguntas.md). Es la medida de todo lo demás: si las consultas se
parecen demasiado a las `preguntas` de los nodos, las métricas mienten.

Muestra a la persona un resumen (cuántas por tipo y 10 ejemplos de cada uno) antes de usarlo para ajustar.

### 6. Medir y corregir

```bash
pregunta-al-sitio evaluar contenido --borradores
```

Objetivos en validación: top-3 ≥ 90 %, precisión en zona alta ≥ 95 %, fuga ≤ 3 %, falso rechazo ≤ 5 %.
Para cada error que informe `evaluar`, aplica la corrección que corresponda según
[referencia/diagnostico.md](referencia/diagnostico.md) y vuelve a medir.

Reglas de esta etapa:

- Corrige el contenido (preguntas, keywords, sinónimos, diccionario, ámbito); el set de evaluación solo
  se corrige si la etiqueta estaba mal, y lo dices.
- Mira los errores de **ajuste** para corregir. La validación es el examen: no agregues a los nodos
  frases copiadas de consultas de validación.
- Cuando el contenido esté estable, `calibrar --escribir` y `evaluar` de nuevo. `calibrar` muestra el
  compromiso entre falso rechazo y fuga para cada umbral `Cm`; si la persona prefiere rechazar menos,
  usa `--max-falso-rechazo` (por ejemplo `3%`).
- Las consultas `seguimiento` no entran en las métricas: `evaluar` informa su acierto aparte.
- Lee los intervalos de confianza: con menos de 100 consultas de validación, una diferencia de 2 o 3
  puntos es ruido. Si `evaluar` avisa de sobreajuste (ajuste más de 8 puntos sobre validación), deja de
  corregir contra el ajuste y agrega consultas nuevas al set.
- Si un artículo le gana a un servicio en consultas de oferta, no le quites palabras nodo por nodo: ajusta
  `config.tipos`. `evaluar` muestra las métricas por familia (oferta y contenido).

### 7. Entrega — Alto

Informe breve a la persona: métricas de validación, errores que quedan y por qué, nodos en borrador y
pendientes abiertos. Para que pruebe el widget antes de aprobar, construye con `build --borradores`.
Con su aprobación, cambia los nodos a `estado: aprobado` y corre `build` sin `--borradores`.

## Cuándo volver a correr

Después de cambiar nodos, diccionario o ámbito: `validar`, `evaluar`. Si las métricas cambian, `calibrar
--escribir`. Cuando lleguen consultas reales sin respuesta (opción `sinRespuesta` del widget), agrégalas
al set con su etiqueta y repite la etapa 6.
