# Leer `evaluar` y corregir

```
Validación: top-1 89.8% · top-3 95.9% · MRR 0.925 · prec. alta 100.0% (42.5% en alta) · fuga 0.0% · falso rechazo 4.5% · cumple
...
Errores en validación (6):
  [coloquial] "q onda con los respaldos" → media hosting, seguridad (esperado respaldos)
```

## Métricas

| Métrica | Qué mide | Objetivo |
|---|---|---|
| top-1 / top-3 | el nodo correcto queda primero / entre los tres primeros | top-3 ≥ 90 % |
| MRR | posición promedio del nodo correcto | cuanto más cerca de 1, mejor |
| precisión alta | de las respuestas directas (zona alta), cuántas son correctas | ≥ 95 % |
| % en alta | cuántas consultas se responden directo, sin "¿Te refieres a…?" | informativo |
| fuga | generales respondidas con un nodo | ≤ 3 % |
| falso rechazo | consultas sobre el sitio que terminan en contacto | ≤ 5 % |

Zonas: **alta** responde directo; **media** pregunta "¿Te refieres a A o B?"; **mixta** ofrece ver el
nodo o escribir al equipo; **baja** va a contacto.

## Cada error, su corrección

Lee la línea completa: zona, primeros candidatos y esperado. Corrige en este orden, del cambio más
local al más general.

| Síntoma | Causa probable | Corrección |
|---|---|---|
| esperado en 2.º o 3.º lugar, otro nodo primero | dos nodos comparten vocabulario | diferenciar keywords y preguntas; si son el mismo tema, fusionar |
| esperado fuera del top-3 | el nodo no tiene las palabras del visitante | agregar la palabra a `keywords` o una pregunta con esa forma; si es jerga general, al `diccionario` |
| zona baja con el esperado primero | puntaje bajo: consulta corta o con palabras raras | más keywords y sinónimos; revisar que la palabra no esté solo en el cuerpo |
| `ambito: general` en una consulta sobre el sitio | falta la marca u oferta | agregar a `ambito.marcas` u `oferta` |
| general respondida con un nodo (fuga) | la fórmula no está en `genericas`, o una palabra de `oferta`/`necesidad` la marca como propia | agregar la fórmula; quitar la palabra ambigua |
| tema que se deriva respondido con un nodo | falta en `ambito.derivar` | agregarlo (y a `derivar_salvo` lo que no debe derivarse) |
| tipeo que no encuentra el nodo | palabra de menos de 4 letras o muy distinta | agregar la variante al `diccionario` |
| zona alta incorrecta | dos nodos muy parecidos y uno gana por poco | diferenciar los nodos; después `calibrar` |

Después de cada ronda de cambios: `validar`, `evaluar`. Cuando no queden correcciones de contenido
evidentes, `calibrar --escribir` y `evaluar` de nuevo.

## Cuándo parar

- Las métricas de validación cumplen los objetivos.
- Los errores que quedan son ambiguos de verdad (dos respuestas razonables) o piden un dato que el sitio
  no publica. Infórmalos en vez de forzarlos.
- Con unas 150 consultas, diferencias de 2 a 3 puntos son ruido: no persigas un punto cambiando
  contenido que estaba bien.
