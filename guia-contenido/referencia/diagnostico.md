# Leer `evaluar` y corregir

```
Validación: top-1 91.3% · top-3 97.8% · MRR 0.942 · prec. alta 100.0% (41.4% en alta) · fuga 0.0% · falso rechazo 2.4% · cumple
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
| tipeo que no encuentra el nodo | palabra de menos de 5 letras, más de una errata en 5 a 8 letras o más de dos desde 9 | agregar la variante al `diccionario` |
| zona alta incorrecta | dos nodos muy parecidos y uno gana por poco | diferenciar los nodos; después `calibrar` |
| un artículo o novedad gana a un servicio, o compite en "¿Te refieres a…?" | el contenido comparte vocabulario con la oferta | `config.tipos` con `peso: 0.8` para el contenido; no quitar palabras nodo por nodo |
| un nodo secundario gana al principal de su tema | sus preguntas repiten el nombre del tema | variar las preguntas (`validar` lo avisa) |
| una o dos palabras ("servicios") van a contacto con el esperado primero | puntaje normalizado bajo por la brevedad | `calibrar --escribir` (prueba `normaPorTerminos`); agregar consultas cortas al set |
| "¿qué es X?" va a contacto siendo X un tema del sitio | X no está en `ambito.marcas` | agregarlo a `marcas` |

Después de cada ronda de cambios: `validar`, `evaluar`. Cuando no queden correcciones de contenido
evidentes, `calibrar --escribir` y `evaluar` de nuevo.

## Calibrar: falso rechazo frente a fuga

`calibrar` imprime, para cada umbral `Cm` (cobertura mínima de la zona media), el falso rechazo y la
fuga del mejor candidato en ajuste y en validación, y marca el elegido. Subir `Cm` manda más consultas a
contacto: baja la fuga y sube el falso rechazo. `calibrar` descarta primero los umbrales que dejan el
falso rechazo de **validación** sobre el máximo (5 % por defecto; `--max-falso-rechazo 3%` lo cambia).
Si ninguno lo cumple, lo dice: el problema es de contenido, no de umbrales.

## Confianza de la validación

`evaluar` y `calibrar` muestran el intervalo de Wilson al 95 % de cada métrica de validación. Con 74
consultas que esperan nodo, un top-3 de 90,5 % va de 81,7 % a 95,3 %: dos contenidos cuyos intervalos se
cruzan no son distinguibles. Avisan además:

- **Validación con menos de 100 consultas**: agrega consultas antes de seguir ajustando.
- **Ajuste más de 8 puntos sobre validación en top-3**: probable sobreajuste. El contenido se adaptó a las
  consultas de ajuste; corregir más contra ellas no generaliza.

`calibrar` hace también una comprobación sintética: usa el título corto y la primera keyword de cada
nodo como consulta e informa cuáles terminan en contacto con los umbrales elegidos.

## Cuándo parar

- Las métricas de validación cumplen los objetivos.
- Los errores que quedan son ambiguos de verdad (dos respuestas razonables) o piden un dato que el sitio
  no publica. Infórmalos en vez de forzarlos.
- Con unas 150 consultas, diferencias de 2 a 3 puntos son ruido: no persigas un punto cambiando
  contenido que estaba bien.
