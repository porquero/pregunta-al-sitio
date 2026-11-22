# Estado del proyecto — pregunta-al-sitio

Vista rápida de qué está hecho y qué falta, para decidir con qué seguir. Se actualiza en cada sesión.
El detalle técnico vive en `README.md` y en los comentarios de cada módulo; este archivo solo resume.

Convención: 🔧 **Implementado, sin verificar** (el código existe) · ✅ **Verificado** (dice cómo: tests,
métricas o prueba en el navegador) · ⏳ **Pendiente**.

## Qué es

Librería pública para agregar a cualquier sitio un chat flotante "Pregunta al sitio" que responde con
el contenido del sitio usando un buscador BM25F en el navegador (sin LLM ni backend al responder).
Extraída del chat de Playa SPA. v1 solo español. Licencia MIT.

Repo: `C:\Users\criff\OneDrive\Documentos\Prgs\pregunta-al-sitio`, rama `main`. Sin remoto todavía
(se publicará en GitHub; no crear el remoto ni hacer push sin preguntar).

## Último trabajo (2026-11-21)

- Motor: prioridad por tipo y límites vistos en Playa SPA real (91 nodos, 248 consultas; carpeta
  `playa-chat`, solo leída; las pruebas usaron una copia). Commit `a08e07b`.
  - `config.tipos` `{ tipo: { peso, respaldo } }`: peso multiplica el puntaje antes de zona, margen y orden;
    `respaldo` = segunda vuelta. `config.empate` (5 %) desempata por prioridad en opciones y chips.
  - `normaPorTerminos` (consultas de 1 o 2 palabras) y `motor.tfLog: [preguntas]` (saturación); `calibrar`
    prueba ambas y escribe `normaPorTerminos`. Sin estas claves el motor es el de antes (índice viejo de
    Playa: mismas métricas).
  - Ámbito: `derivar` también por términos con diccionario; nuevo `excluir_si`. `validar`: `config.tipos`,
    repetición de un tema ajeno en > 60 % de las preguntas, `genericas` con variante del diccionario.
  - `evaluar`: Wilson 95 %, avisos (validación < 100, sobreajuste > 8 puntos, < 10 % consultas cortas),
    métricas por familia y segunda vuelta. `calibrar`: comprobación sintética. `cobertura --normalizar`.
    Plantilla `guia-contenido/herramientas/convertir.sh` (URL sin `.html`). Guía y README con 7 lecciones.
  - Playa (validación, copia con `tipos` peso 0,8 + `que hora es` en genericas + recalibrado): top-3
    89,2 → 90,5 %, prec. alta 87,7 → 91,8 %, en alta 58,2 → 62,2 %, falso rechazo 5,5 → 4,1 %, fuga
    7,7 → 0 %. Aceptación 9/9. `respaldo` medido: top-3 79,7 %, no recomendado como mecanismo principal.
- README: ejemplo anotado de `sitio.yaml` (ámbito con `derivar`/`excluir_si`, `config` con las claves que
  escribe `calibrar` y las que escribe uno: `opcionesMedia`, `tipos`, `empate`). Commit `cf691e8`.
- CLI: comando `vocabulario` (hecho en otro chat, en la copia `pregunta-al-sitio-cli`): cuenta las palabras
  de las fuentes y lista las frecuentes que, consultadas solas, terminan en contacto (zona baja); sale con 1
  si hay. `--min` (5), `--largo` (5), `sitio.yaml > vocabulario.ignorar`. README y SKILL.md documentados. Commit `df63224`.

## Último trabajo (2026-11-19)

- UX tras pruebas con usuarios (commit `b2b3180`):
  1. "Ver más" pasa a ser un botón destacado "Ver más sobre {titulo} →", antes de los chips, que llevan el
     título visible "Sigue preguntando" para separarlos.
  2. Sin respuesta: el formulario de contacto queda plegado tras "Escribir al equipo" (secundario), con
     "Puedes seguir preguntando…" y los chips de la bienvenida no vistos (`sugerenciasSinRespuesta`).
     Pedir escribir al equipo lo sigue abriendo directo. El bloque de contacto omite su "Ver más" si hay
     canal de contacto. Probado en el navegador, claro y oscuro.
- Bug visual (commit `5592dd5`): el `<a class="boton">` del contacto por enlace quedaba con el texto del color
  del fondo porque `.pas-respuesta a` lo pisaba. Ahora la regla es `a:not(.boton)`. Test de cascada en
  `tests/widget/estilos.test.mjs`; revisado en el navegador en claro y oscuro. `.pas-cta a` es un enlace de
  texto y no tenía el problema. También se corrigió el test de `skill`, que no esperaba `rubros.md`.
- Rubro y schema.org (solo documentación, commit `36b6418`): la guía pide el rubro y el contexto al empezar,
  elige el tipo de schema.org y usa sus propiedades como pauta de los nodos (`referencia/rubros.md`).
  Campos opcionales `sitio.yaml > rubro` y `schema` por nodo: el chat no los usa; `validar` y `build` los
  aceptan (probado con una copia de Playa).
- Hallazgos del primer sitio real (turismo, 54 nodos), 11 puntos (commit `63abacd`):
  1. `build --widget` empaqueta antes de copiar (con esbuild) o falla si `src/` es más reciente que
     `dist/`; test que compara el hash del bundle con una compilación nueva.
  2. Autoenlace con `autoenlazar_destino: enlace` y sin enlace del sitio: texto, no `href="#"`.
  3. `validar`: error por claves desconocidas o nulas en `tarjeta.items/cifras/cta` (caso "2,5 horas").
  4. `sitio` en la plantilla de `iniciar`; `build` cuenta los enlaces omitidos; sin `sitio` infiere
     el dominio más frecuente de los `enlace` y avisa.
  5. Chips: el widget no repite nodos ya vistos y completa con aristas; el origen solo si no hay otra
     opción. `validar` avisa aristas recíprocas, una sola saliente y nodos con aristas de > 15 %.
  6. `validar` avisa nombres enlazables comunes o mencionados en > 10 respuestas; `autoenlazar: false`.
  7. Seguimiento: **fuera de las métricas** (decidido). Con contexto ×1,6 las 8 de Playa aciertan, pero
     el 2,4 % de las demás pierde el top-1 con un nodo anterior sin relación, y `evaluar` no lo mide.
  8. `pregunta-al-sitio cobertura contenido --fuentes fuentes` (regla "una fuente con URL: es un
     nodo"; excepciones en `sitio.yaml > cobertura.excluir`).
  9. `calibrar` muestra el compromiso falso rechazo / fuga por `Cm`, acepta `--max-falso-rechazo` y
     descarta umbrales con falso rechazo de validación sobre el máximo.
  10. Erratas por distancia de edición (1 en 5 a 8 letras, 2 desde 9) antes de los trigramas.
  11. README con `wa.me/TU-NUMERO`; el widget avisa en consola si el enlace lo conserva.
  Probado en el navegador: chips sin repetir y aviso de consola.

- Regla: el chat solo enlaza al sitio principal (`sitio: misitio.cl` en `sitio.yaml`, subdominios y
  cualquier ruta; también rutas relativas, `mailto:` y `tel:`). `build` omite el resto en la
  respuesta, la tarjeta y el "Ver más"; `validar` lo avisa; `iniciar --sitio`. El autoenlace ya no
  abre pestañas nuevas: por defecto abre el nodo en el chat. En Playa (`sitio: playaspa.cl`), Wotel
  pierde su "Ver más" a wotel.cl. Probado en el navegador.

- Enlaces entre nodos: `[texto](nodo:id)` y autoenlace opcional (`autoenlazar` en `sitio.yaml`,
  `alias`, sinónimos con `+`). Con Playa: 14 enlaces, +1,4 % de índice, mismas métricas. Probado en el
  navegador (clic y Espacio abren el nodo sin navegar).

## Trabajo del 2026-11-18

- Fase 4 (guía de contenido) escrita: skill en `guia-contenido/` con 4 referencias, comandos `iniciar`
  y `skill`, y revisión del set de preguntas dentro de `evaluar`. La guía todavía no se ha usado de
  punta a punta; la primera prueba real es armar el sitio de ejemplo de la fase 5 con ella.
- README reescrito con "Cómo funciona" (fuentes → nodos → índice) e "Inicio rápido" en 5 pasos;
  la guía aclara que las fuentes (`fuentes/`) no son nodos. Nuevo `build --widget` (copia el script
  junto al índice). Pasos probados en una carpeta temporal con `npm link`.
- Fase 3 (widget) probada en el navegador por Cristian el 2026-11-18: funciona bien.
- Calibración con criterio de precisión alta 99 % (decidido el 2026-11-12). Con Playa deja solo 15 %
  de consultas en zona alta (hoy 42,5 %); el fixture conserva la config de producción de Playa.

## Fases

| Fase | Ítem | Estado |
|---|---|---|
| 1 | Repo, estructura, `package.json` (ESM, Node ≥ 20), LICENSE MIT | ✅ Commit `a8cc3fa` |
| 1 | Motor (`src/motor`): resolver, normalizar, ambito, dialogo, sesion, config | ✅ Tests + métricas iguales a Playa |
| 1 | Diccionario configurable: base genérica + `datos.diccionario` del sitio | ✅ Tests |
| 1 | Config por índice (`datos.config`: motor, zonas, opcionesMedia) | ✅ Tests |
| 1 | Tipo de ámbito `playa` renombrado a `sitio` | ✅ Tests |
| 2 | `build`: md → `indice.json` con respuesta HTML, enlace y chips de seguimiento | ✅ Tests; con Playa igual a la exportación PHP |
| 2 | `validar`: estructura fija + reglas de estilo en `sitio.yaml > validar` | ✅ Tests; Playa 0 errores / 0 avisos, igual que PHP |
| 2 | `evaluar` y `calibrar` como comandos; `calibrar --escribir` en `sitio.yaml` | ✅ Tests |
| 2 | Comando `pregunta-al-sitio` (bin) y `yaml` como dependencia | ✅ Probado vía `npm link`; `npx` espera la publicación |
| 2 | Commit de la fase 2 | ✅ `1205b64` |
| 3 | Widget `<pregunta-al-sitio>` con Shadow DOM, instalable con un `<script data-indice>` | ✅ Navegador: preguntar, chips, opciones A/B, restaurar, borrar |
| 3 | Contacto por enlace (`{mensaje}`) o webhook (JSON o form, consentimiento, trampa para bots) | ✅ Navegador (envío real al webhook de prueba) + tests |
| 3 | Accesibilidad: dialog, log, etiquetas, Escape devuelve el foco, pantalla completa en móvil | ✅ Navegador (revisión manual, sin lector de pantalla real) |
| 3 | Carga diferida del índice, aviso y reintento si falla | ✅ Navegador |
| 3 | Script empaquetado `dist/pregunta-al-sitio.js` (esbuild, 33 KB / 12 KB gzip) | ✅ `npm run empaquetar` |
| 3 | Tema oscuro y posición izquierda | ✅ Navegador |
| 3 | Commit de la fase 3 | ✅ `8b2a231` |
| 4 | Guía como skill (`guia-contenido/SKILL.md` + `referencia/`): proceso en 7 etapas con 3 altos de revisión humana | 🔧 Escrita; sin probar con un sitio real |
| 4 | `iniciar`: plantillas de `sitio.yaml` (ámbito genérico), `inicio`, `contacto` y `preguntas.yaml` | ✅ Tests: pasan `validar` y `build` |
| 4 | `skill`: copia la guía a `.claude/skills/pregunta-al-sitio-contenido` | ✅ Tests |
| 4 | `evaluar` revisa el set (ids, tipos, repetidas, composición, nodos sin consultas) y muestra errores de ajuste | ✅ Tests |
| 4 | README con inicio rápido; `build --widget` | ✅ Pasos probados en carpeta temporal + test |
| 4 | Commit de la fase 4 | ✅ `9dd9f1d` |
| 4+ | Enlaces entre nodos: `nodo:`, autoenlace, `validar` de ids rotos, clic en el widget | ✅ Tests + navegador · `975eb88` |
| 4+ | Solo enlaces del sitio principal (`sitio` en `sitio.yaml`) | ✅ Tests + navegador · commit siguiente al `975eb88` |
| 4+ | Hallazgos del sitio de turismo (11 puntos: widget al día, tarjetas, dominio, chips, cobertura, calibrar, erratas…) | ✅ `63abacd` |
| 4+ | Prioridad por tipo de nodo, consultas cortas, saturación, ámbito, intervalos de confianza | ✅ Tests + métricas Playa + navegador · `a08e07b` |
| 5 | Sitio de ejemplo, documentación, empaquetado y publicación | ⏳ |
| 6 | (Opcional) Playa migra a la librería | ⏳ |

## Métricas de referencia (fixture Playa, partición de validación)

top-1 91,3 % · top-3 97,8 % · precisión alta 100 % · fuga 0 % · falso rechazo 2,4 % (sin las 8 consultas
`seguimiento`, que se informan aparte: 75 % de acierto). Antes de excluirlas: 89,8 / 95,9 / 100 / 0 / 4,5.
Ajuste con distancia de edición: top-1 88,4 %, top-3 94,2 %, falso rechazo 1,5 % (antes 87,0 / 92,8 / 3,0).
Objetivo por sitio: top-3 ≥ 90 %, precisión alta ≥ 95 %, fuga ≤ 3 %, falso rechazo ≤ 5 %.

## Decisiones abiertas

- **Calibración 99 %:** ¿se queda así (más "¿Te refieres a A o B?") o se cambia el desempate para
  maximizar respuestas en zona alta entre los umbrales que cumplen?
- **Set de Playa:** ninguna consulta espera el nodo `por-que-playa` (lo detectó la revisión del set).
  Se corrige en Playa, no aquí: el fixture refleja el set actual.
- **`dist/` no se versiona:** se genera al publicar en npm (`prepublishOnly`). Si se quiere servir
  desde GitHub vía jsDelivr sin npm, habría que commitearlo en cada versión.

- **Autoenlace con Playa:** el título hasta la coma genera falsos positivos con palabras comunes
  ("Seguridad, respaldo…" enlaza "seguridad"; "Nosotros, un socio…" enlaza "nosotros"). Por eso queda
  apagado por defecto. Si Playa lo enciende, hay que reescribir esos títulos.

- **Wotel en Playa:** wotel.cl es otro dominio, así que su "Ver más" se omite. Si se quiere
  conservar, `sitio` acepta una lista (`[playaspa.cl, wotel.cl]`), pero eso contradice la regla de que
  el visitante no salga del sitio. Decidir en Playa.
- **`mailto:` y `tel:`** se permiten (no abren otro sitio web). Si se quieren prohibir, es una línea en
  `crearFiltroUrl`.

- **Avisos nuevos en Playa:** `validar` da 34 avisos (20 aristas recíprocas, 10 nodos con una sola
  arista saliente, 3 nodos que reciben aristas de más del 15 %). Se corrigen en Playa, no en el fixture.
- **Commit `802aba7`** (guía: "una fuente con URL: es un nodo") lo hizo otra sesión; citaba un
  `cobertura-url.mjs` que no existía y ahora apunta al subcomando `cobertura`.

## Cómo retomar

```bash
npm install
npm test
node cli/bin.mjs evaluar tests/fixtures/playa
npm run empaquetar && npm run dev   # widget en http://localhost:5178/dev/
```
