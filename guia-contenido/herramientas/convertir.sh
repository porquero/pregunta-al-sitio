#!/usr/bin/env bash
# Convierte las páginas HTML descargadas con wget a Markdown para fuentes/, con título y línea URL:.
# Requiere html2markdown (https://github.com/JohannesKaufmann/html-to-markdown).
#
# Descarga previa, por ejemplo:
#   wget --mirror --adjust-extension --convert-links --no-parent -P salida https://misitio.cl/
# --adjust-extension guarda /servicios como servicios.html. Si el sitio publica sus páginas sin
# extensión, deja QUITAR_HTML=1 para que la línea URL: sea la publicada (https://misitio.cl/servicios)
# y coincida con el enlace de los nodos. Si el sitio usa .html en sus direcciones, pon QUITAR_HTML=0.
# Para comparar fuentes antiguas que ya traen .html: pregunta-al-sitio cobertura --normalizar.

DOMAIN="misitio.cl"                 # dominio descargado (carpeta dentro de salida/)
SRC="salida"                        # carpeta de origen
OUT="fuentes"                       # carpeta de destino
SUFFIX=" | Nombre del Sitio"        # sufijo del título que se recorta (vacío si no hay)
QUITAR_HTML=1                       # 1: URL sin .html ni index.html; 0: tal como está en disco
SELECTORS=("main" ".entry-content" "#content" "body")   # orden de prueba
EXCLUDE="nav, header, footer, aside, script, style, noscript, .related-posts, #comments"

rm -rf "$OUT"; mkdir -p "$OUT"

find "$SRC/$DOMAIN" -name "*.html" | while read -r f; do
  out="$OUT/${f#$SRC/$DOMAIN/}"; out="${out%.html}.md"
  mkdir -p "$(dirname "$out")"

  # URL a partir de la ruta en disco: index.html es la carpeta; con QUITAR_HTML, sin extensión.
  rel="${f#$SRC/}"; rel="${rel%index.html}"
  [ "$QUITAR_HTML" = "1" ] && rel="${rel%.html}"
  url="https://$rel"

  # Título: og:title, y si falta, la etiqueta <title>
  title=$(grep -oP '(?<=<meta property="og:title" content=")[^"]*' "$f" | head -1)
  [ -z "$title" ] && title=$(grep -oP '(?<=<title>)[^<]*' "$f" | head -1)
  [ -n "$SUFFIX" ] && title="${title%"$SUFFIX"}"

  # Contenido: primer selector que entregue texto
  for sel in "${SELECTORS[@]}"; do
    body=$(html2markdown --include-selector "$sel" --exclude-selector "$EXCLUDE" < "$f")
    [ -n "$(printf '%s' "$body" | tr -d '[:space:]')" ] && break
  done

  printf '# %s\n\nURL: %s\n\n%s\n' "$title" "$url" "$body" > "$out"
  echo "$sel | $url" >> "$OUT/_log.txt"
done

echo "HTML de origen:  $(find "$SRC/$DOMAIN" -name '*.html' | wc -l)"
echo "Markdown creados: $(find "$OUT" -name '*.md' | wc -l)"
echo "Selector usado por página:"
cut -d'|' -f1 "$OUT/_log.txt" | sort | uniq -c
