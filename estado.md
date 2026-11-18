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

- Fase 2 (CLI) terminada, con tests en verde y commiteada en `main`.
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
| 2 | Comando `pregunta-al-sitio` (bin) y `yaml` como dependencia | 🔧 Probado con `node cli/bin.mjs`; `npx` sin probar |
| 2 | Commit de la fase 2 | ✅ En `main` |
| 3 | Widget flotante: Shadow DOM, accesible, contacto por enlace o webhook | ⏳ |
| 4 | Guía para que un agente genere nodos, sinónimos, aristas y preguntas | ⏳ |
| 5 | Sitio de ejemplo, documentación, empaquetado y publicación | ⏳ |
| 6 | (Opcional) Playa migra a la librería | ⏳ |

## Métricas de referencia (fixture Playa, partición de validación)

top-1 89,8 % · top-3 95,9 % · precisión alta 100 % · fuga 0 % · falso rechazo 4,5 %.
Objetivo por sitio: top-3 ≥ 90 %, precisión alta ≥ 95 %, fuga ≤ 3 %, falso rechazo ≤ 5 %.

## Decisiones abiertas

- **Calibración 99 %:** ¿se queda así (más "¿Te refieres a A o B?") o se cambia el desempate para
  maximizar respuestas en zona alta entre los umbrales que cumplen?
- **Formulario de contacto:** el de Playa no se portó; la fase 3 define enlace o webhook.

## Cómo retomar

```bash
npm install
npm test
node cli/bin.mjs evaluar tests/fixtures/playa
```
