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
pregunta-al-sitio calibrar contenido --escribir [--borradores]
pregunta-al-sitio build contenido -o public/indice.json --widget
```

## Proceso

Sigue las etapas en orden. Las marcadas con **Alto** terminan esperando la revisión de la persona: no
avances sin su respuesta.

### 1. Fuentes e inventario

1. Junta las fuentes: lo que haya en `fuentes/` (o la carpeta que te indiquen), el sitio publicado si
   te dan su URL (cada página relevante, incluido el pie y las páginas legales), documentos (PDF,
   presentaciones, textos) y preguntas reales de clientes si existen. No modifiques las fuentes. Si no
   hay ninguna, pregunta de dónde sacarlas antes de seguir.
2. Si no existe la carpeta, créala con `iniciar`.
3. Escribe `informes/inventario.md`: una fila por fuente con tipo, tema, secciones útiles y
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

Escribe `informes/mapa-de-nodos.md` con una tabla: id, tipo, título, enlace, formato, fuente
(archivo y sección), aristas previstas y estado. Criterios en [referencia/nodos.md](referencia/nodos.md).

- Un nodo por tema que un visitante preguntaría por separado. Un sitio pequeño suele quedar con 10 a 20
  nodos; uno de servicios, con 25 a 40.
- Siempre: `inicio` (tipo `saludo`) y `contacto`.
- Siempre: un nodo por cada fuente con `URL:` (regla de la etapa 1). Antes de pedir la revisión, corre
  `node .claude/skills/pregunta-al-sitio-contenido/cobertura-url.mjs` sobre el mapa ya escrito en nodos, o
  cruza a mano la columna `enlace` con las URL de las fuentes. Toda fuente sin nodo se lista en el mapa, en
  una sección "Fuentes sin nodo" con el motivo permitido (duplicado exacto o exclusión pedida).
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
- Un dato que falta se marca `[REDACTAR …]` y el nodo queda en `estado: borrador`.
- Todo nodo nace en `borrador`; lo aprueba la persona.

Corre `validar` hasta que no queden errores y `cobertura-url.mjs` hasta que no quede ninguna fuente con
`URL:` sin nodo.

### 4. Diccionario y ámbito

En `sitio.yaml` (detalle en [referencia/ambito-y-diccionario.md](referencia/ambito-y-diccionario.md)):

- `diccionario`: variantes y jerga que el visitante escribe distinto del sitio (`wsp: whatsapp`,
  `excel: planilla`, `cuanto cuesta: precio`).
- `ambito.marcas`: el nombre del sitio, sus marcas y productos.
- `ambito.derivar`: temas que el chat no responde aunque haya palabras parecidas (empleo, por ejemplo).
- Revisa `oferta`, `necesidad` y `genericas`, que `iniciar` deja con valores genéricos.

### 5. Set de evaluación — Alto

Escribe `preguntas.yaml` con al menos 150 consultas, según
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
- Cuando el contenido esté estable, `calibrar --escribir` y `evaluar` de nuevo.

### 7. Entrega — Alto

Informe breve a la persona: métricas de validación, errores que quedan y por qué, nodos en borrador y
pendientes abiertos. Con su aprobación, cambia los nodos a `estado: aprobado` y corre `build`.

## Cuándo volver a correr

Después de cambiar nodos, diccionario o ámbito: `validar`, `evaluar`. Si las métricas cambian, `calibrar
--escribir`. Cuando lleguen consultas reales sin respuesta (opción `sinRespuesta` del widget), agrégalas
al set con su etiqueta y repite la etapa 6.
