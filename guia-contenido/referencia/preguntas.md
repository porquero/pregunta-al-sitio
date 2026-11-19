# Set de evaluación (`preguntas.yaml`)

Consultas etiquetadas con la respuesta correcta. `evaluar` las divide en ajuste (60 %) y validación
(40 %) y mide el chat contra ellas; `calibrar` elige los umbrales con la parte de ajuste.

```yaml
consultas:
  - { consulta: "tienen hosting para wordpress?", esperado: hosting, tipo: coloquial }
  - { consulta: "¿Hacen respaldos o los tengo que hacer yo?", esperado: [respaldos, hosting], tipo: anexo }
  - { consulta: "hostin con ssl", esperado: hosting, tipo: tipeo }
  - { consulta: "¿Qué es un certificado SSL?", esperado: contacto, tipo: general, frontera: true }
  - { consulta: "Mi página se cae seguido, ¿me pueden ayudar?", esperado: hosting, tipo: necesidad }
  - { consulta: "asdf", esperado: contacto, tipo: ajena }
  - { consulta: "¿y cuánto se demoran?", esperado: plazos, tipo: seguimiento, contexto: hosting }
```

## Composición mínima

| Tipo | Qué es | Mínimo |
|---|---|---|
| `anexo` | preguntas frecuentes del negocio, con otras palabras | el grueso del set |
| `coloquial` | jerga, sin signos, muy cortas o muy largas | 15 |
| `tipeo` | errores de tipeo reales (letras cambiadas, sin tildes, palabras pegadas) | 15 |
| `multiple` | dos intenciones en una consulta; `esperado` con una lista de ids aceptables | 10 |
| `general` | conocimiento general; esperan `contacto` | 30 (15 con `frontera: true`) |
| `necesidad` | el visitante cuenta su problema; esperan el nodo pertinente | 15 |
| `ajena` | saludos, spam, sin sentido | 10 |
| `fuera` | temas que el sitio decide no responder (empleo, precios no publicados); esperan `contacto` | según el sitio |
| `seguimiento` | consulta que solo tiene sentido después de otra; lleva `contexto`. **No entra en las métricas** | opcional |

Las consultas `seguimiento` quedan fuera de las métricas de `evaluar` y `calibrar`. El chat responde cada
consulta sin mirar el nodo anterior: dar peso al contexto haría acertar estas consultas, pero con Playa
cambiaba el primer resultado del 2,4 % de las demás cuando el nodo anterior no tenía relación, y `evaluar`
no puede medir ese costo. `evaluar` informa su acierto aparte ("Seguimiento … acierto"); sirven para ver
si una pregunta elíptica ("¿y cuánto dura?") se entiende sola.

Total: al menos 150. `evaluar` avisa si faltan consultas en total, generales, de frontera, de necesidad
o ajenas, y si hay nodos sin ninguna consulta. Los mínimos de coloquial, tipeo y múltiple los cuidas tú.

## Reglas

- Escribe como un visitante. **No copies** las `preguntas` de los nodos ni las parafrasees de cerca:
  el set mide si el chat entiende formas que no previste.
- Si existen preguntas reales (formularios de contacto, correos, búsquedas del sitio), úsalas primero,
  sin datos personales.
- Las generales de **frontera** comparten vocabulario con un nodo ("¿Qué es un certificado SSL?" frente
  al nodo de hosting). Son las que prueban el detector de ámbito.
- Las de **necesidad** describen una situación sin nombrar el servicio ("tengo los pedidos en una
  planilla y se me pierden").
- Una consulta con dos respuestas razonables lleva ambas en `esperado`.
- Reparte las consultas entre todos los nodos, con más peso en los temas que más se preguntan.
- Agrupa por tipo en el archivo: la partición toma, dentro de cada tipo, las posiciones 0, 2 y 4 de
  cada bloque de cinco para ajuste. Agregar consultas al final de un tipo no mueve las anteriores.
