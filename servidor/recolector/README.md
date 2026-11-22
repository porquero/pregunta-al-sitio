# Recolector de consultas (anónimo)

Guarda lo que escriben los visitantes en el chat, para saber qué preguntan y si el chat les respondió. Corre
en el hosting del cliente y entrega un CSV con cuatro columnas: `FECHA;URL;TEXTO;RESPUESTA`.

## Qué guarda y qué no

| Guarda | No guarda |
|---|---|
| Fecha y hora (hora de Chile, la pone el servidor) | IP, cookies, identificador de sesión |
| Página donde se usó el chat (sin parámetros ni `#`) | Navegador, dispositivo, ubicación |
| Texto escrito por el visitante, hasta 300 caracteres | El texto completo de la respuesta |
| Una frase de la respuesta, hasta 150 caracteres: el título de la sección mostrada, `Opciones: A \| B`, `Conocimiento general: A`, `Sin respuesta` o `Derivada a contacto` | Los clics en botones y en preguntas sugeridas |

Antes de guardar, el texto pasa por una limpieza: correos → `[correo]`, enlaces → `[enlace]`, RUT → `[rut]`,
secuencias de 7 o más dígitos (teléfonos, tarjetas) → `[número]`. Una consulta que queda solo en marcas no se
guarda. **No se pueden detectar nombres propios**: por eso el texto se recorta y el servicio no pide ningún dato.

## Instalación (hosting con PHP 8.1 o superior)

1. Subir `registrar-consultas.php` a una carpeta del sitio, por ejemplo `/pas/`.
2. Revisar la configuración al inicio del archivo: `$origenesPermitidos` (dominios del sitio, por defecto el
   ejemplo `misitio.cl`: hay que cambiarlo), `$limitePorHora` y `$separador`. También se pueden dar por
   variables de entorno: `PAS_ORIGENES` (orígenes separados por coma, con `https://`), `PAS_ARCHIVO` (ruta
   del CSV) y `PAS_LIMITE` (consultas por hora y visitante).
3. Comprobar que PHP pueda escribir en la carpeta. La primera consulta crea `datos/consultas.csv` y protege la
   carpeta con `.htaccess` (Apache). En Nginx hay que bloquear `/pas/datos/` en la configuración del servidor.
4. Probar desde un terminal:
   ```
   curl -i -X POST https://SITIO/pas/registrar-consultas.php -H "Content-Type: application/json" -H "Origin: https://SITIO" -d '{"texto":"prueba","url":"https://SITIO/"}'
   ```
   Debe responder `204` y aparecer una fila en el CSV.
5. En el script del chat, agregar `data-metricas="https://SITIO/pas/registrar-consultas.php"`
   (requiere la versión de la librería que envía las consultas).

Si ya había un `consultas.csv` de tres columnas, renómbralo antes de actualizar: el archivo nuevo empieza con
la cabecera de cuatro columnas.

## Uso de los datos

- Descargar `datos/consultas.csv` por SFTP y abrirlo en Excel: el separador es `;` y las tildes se ven bien.
- Hacer respaldo y borrar las filas con más de 12 meses (plazo sugerido de conservación).
- Filtrar la columna RESPUESTA por `Sin respuesta`: cada una es contenido por agregar. Se incorpora al set de
  evaluación y se corrige el chat. Las de `Opciones: …` muestran temas que el chat confunde.

## Texto sugerido para la política de privacidad

> El asistente del sitio registra de forma anónima las preguntas que los visitantes escriben, junto con la
> fecha y la página donde las escribieron, para mejorar el contenido del sitio. No se guardan cookies, dirección
> IP ni datos que identifiquen a la persona. Se recomienda no escribir datos personales en el chat.

Revisar este texto con asesoría legal. La Ley 21.719 de protección de datos personales entra en vigencia el
1 de diciembre de 2026, según la información disponible a la fecha de este documento.

## Protecciones incluidas

- Solo acepta peticiones de los dominios configurados, por POST, de hasta 4 KB.
- Límite por visitante y por hora, con un contador temporal que no se guarda en el CSV y se borra solo.
- Neutraliza textos que Excel podría interpretar como fórmulas.
