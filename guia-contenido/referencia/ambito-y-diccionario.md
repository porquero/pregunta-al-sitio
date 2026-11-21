# Ámbito y diccionario

Las dos claves de `sitio.yaml` que más cambian las métricas sin tocar los nodos.

## Diccionario

Antes de buscar, cada palabra de la consulta pasa por el diccionario: `variante → forma canónica`. Así
"wsp", "wasap" y "whatsapp" cuentan como la misma palabra.

```yaml
diccionario:
  wsp: whatsapp
  excel: planilla
  excels: planilla
  cuanto cuesta: precio      # una frase se reemplaza antes que sus palabras sueltas
  valor: precio
  vehiculo: auto
  pagina web: sitioweb       # unir dos palabras en una evita que "web" choque con otros nodos
  mail: null                 # null quita una entrada de la base
```

- El motor trae una base pequeña de variantes ortográficas (whatsapp, correo, gratis, IA); el diccionario
  del sitio se suma y la reemplaza donde coinciden.
- Escribe las formas sin preocuparte de tildes ni mayúsculas: se normalizan.
- La forma canónica debe aparecer en los nodos (en keywords, título o preguntas); si no, el
  reemplazo no ayuda.
- Plurales y conjugaciones ya los junta el motor (`servicio`, `servicios`; `automatizar`,
  `automatización`). Agrega solo lo que la derivación no alcanza: sinónimos, siglas, jerga, marcas, errores
  frecuentes.

## Ámbito

El detector decide, antes de buscar, si la consulta es sobre el sitio. Sirve para dos cosas: que una
pregunta de cultura general ("¿qué es un CRM?") vaya a contacto aunque se parezca a un nodo, y que una
necesidad del visitante ("tengo mis pedidos en Excel") se trate como consulta sobre el sitio.

| Clave | Contenido | Efecto |
|---|---|---|
| `marcas` | nombre del sitio, marcas, productos, temas propios ("BPM"), "este chat" | con una marca, siempre es sobre el sitio |
| `oferta` | segunda persona y verbos de oferta (`ustedes`, `ofrecen`, `tienen`) | igual que una marca |
| `necesidad` | necesidad del visitante (`mi empresa`, `necesito`, `precio`) | con una fórmula general, la consulta es mixta: el chat ofrece ver el nodo o escribir al equipo |
| `genericas` | fórmulas de conocimiento general (`que es`, `como funciona`, `diferencia entre`) | sin ninguna de las anteriores, va a contacto |
| `derivar` | temas que el chat no responde (empleo, precios no publicados, dominios) | va a contacto con el texto de derivación y no se registra como "sin respuesta" |
| `derivar_salvo` | palabras que anulan `derivar` | "se cayó mi sitio web" no se deriva si `sitio web` está en `derivar` y `cayo` en `derivar_salvo` |
| `excluir_si` | palabras de temas ajenos al sitio (`clima`, `horoscopo`, `futbol`) | sin una marca, la consulta es general aunque comparta otra palabra con un nodo |
| `palabras_clave_max` | número (3) | una consulta corta con una keyword del catálogo ("hosting") es sobre el sitio |

Ajustes habituales:

- Agrega a `marcas` cada producto o marca propia, y el nombre del sitio con y sin espacios.
- Si `evaluar` informa **fuga** (una general respondida con un nodo): falta la fórmula en `genericas`, o
  una palabra de `oferta`/`necesidad` aparece en preguntas generales. Quita de `oferta` palabras como
  `son`, `sus`, `estan`: aparecen en "¿qué es X y cuáles son sus ventajas?".
- Si informa **falso rechazo** por ámbito (consultas sobre el sitio que van a contacto con `ambito:
  general`): falta la marca o el verbo en `marcas`/`oferta`, o la fórmula general es demasiado amplia.
- Cada frase se busca como palabras completas sobre el texto normalizado: `que es` no coincide con
  `queso`.
- `marcas`, `oferta`, `necesidad` y `genericas` se comparan **sin** aplicar el diccionario: escribe las
  variantes que use el visitante. `validar` avisa si una fórmula de `genericas` contiene una variante
  del diccionario y falta la forma canónica.
- `derivar` y `excluir_si` además se comparan por términos, con el diccionario aplicado y sin palabras
  vacías: `precio sistema` en `derivar` también detecta "¿cuánto cuesta un sistema?" si el diccionario
  tiene `cuanto cuesta: precio`. Las palabras se comparan enteras: `empleo` no detecta "empleados".
- Una pregunta general que comparte una palabra con un nodo ("¿qué hora es en Japón?" frente a "hora
  gratuita de consultoría") se corrige con la fórmula en `genericas` (`que hora es`) o, si el tema ajeno
  se repite, con sus palabras en `excluir_si`.
