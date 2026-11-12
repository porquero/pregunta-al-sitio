# pregunta-al-sitio

Chat flotante que responde preguntas con el contenido de tu sitio. El buscador (BM25F con tolerancia
a errores de tipeo, sinónimos y detector de ámbito) corre en el navegador: no usa un LLM ni un backend
al responder. v1 solo en español.

> Estado: fase 1 (motor). El CLI, el widget y la guía de contenido vienen después.

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
| `nodos` | `{ id, tipo, titulo, preguntas, keywords, sinonimos, aristas, chips }` |
| `diccionario` | sinónimos del sitio (`variante: canónica`), que se suman al diccionario base; `null` quita una entrada de la base |
| `ambito` | reglas del detector: `marcas`, `oferta`, `necesidad`, `genericas`, `derivar`, `derivar_salvo` |
| `derivacion` | texto que se muestra cuando la consulta va a contacto |
| `config` | `{ motor, zonas, opcionesMedia }`; lo que falte se toma de `src/motor/config.js` |

## Evaluación y calibración

```bash
npm run evaluar -- --indice indice.json --preguntas preguntas.yaml
npm run calibrar -- --indice indice.json --preguntas preguntas.yaml --escribir
```

Sin argumentos usan el fixture de Playa SPA (`tests/fixtures/playa`). Objetivos por sitio: top-3 ≥ 90 %,
precisión en zona alta ≥ 95 %, fuga de conocimiento general ≤ 3 % y falso rechazo ≤ 5 %.

## Desarrollo

Node 20 o superior. `npm install` y `npm test`.

## Licencia

MIT
