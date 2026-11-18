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

## Último trabajo (2026-11-18)

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
| 5 | Sitio de ejemplo, documentación, empaquetado y publicación | ⏳ |
| 6 | (Opcional) Playa migra a la librería | ⏳ |

## Métricas de referencia (fixture Playa, partición de validación)

top-1 89,8 % · top-3 95,9 % · precisión alta 100 % · fuga 0 % · falso rechazo 4,5 %.
Objetivo por sitio: top-3 ≥ 90 %, precisión alta ≥ 95 %, fuga ≤ 3 %, falso rechazo ≤ 5 %.

## Decisiones abiertas

- **Calibración 99 %:** ¿se queda así (más "¿Te refieres a A o B?") o se cambia el desempate para
  maximizar respuestas en zona alta entre los umbrales que cumplen?
- **Set de Playa:** ninguna consulta espera el nodo `por-que-playa` (lo detectó la revisión del set).
  Se corrige en Playa, no aquí: el fixture refleja el set actual.
- **`dist/` no se versiona:** se genera al publicar en npm (`prepublishOnly`). Si se quiere servir
  desde GitHub vía jsDelivr sin npm, habría que commitearlo en cada versión.

## Cómo retomar

```bash
npm install
npm test
node cli/bin.mjs evaluar tests/fixtures/playa
npm run empaquetar && npm run dev   # widget en http://localhost:5178/dev/
```
