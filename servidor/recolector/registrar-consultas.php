<?php
declare(strict_types=1);

/**
 * Recolector anónimo de consultas para pregunta-al-sitio.
 *
 * Recibe por POST { "texto": "...", "url": "https://sitio/pagina", "respuesta": "..." } y agrega una fila a
 * un CSV con cuatro columnas: FECHA;URL;TEXTO;RESPUESTA. "respuesta" es una frase corta que arma el widget
 * (título de la sección mostrada, "Opciones: A | B", "Sin respuesta" o "Derivada a contacto"); es opcional.
 *
 * Qué NO guarda: IP, cookies, identificador de sesión, navegador, ubicación ni el texto completo de la respuesta.
 * Antes de guardar, oculta correos, enlaces, RUT y números largos (teléfonos, tarjetas) del texto.
 * Los nombres propios escritos por el visitante no se pueden detectar: por eso el texto se recorta.
 *
 * Instalación: subir este archivo a una carpeta del hosting del cliente, ajustar la configuración de
 * abajo y apuntar `data-metricas` del widget a su dirección.
 */

// ---------- Configuración ----------
$origenesPermitidos = array_filter(array_map('trim', explode(',', getenv('PAS_ORIGENES') ?: 'https://misitio.cl,https://www.misitio.cl')));
$archivo         = getenv('PAS_ARCHIVO') ?: __DIR__ . '/datos/consultas.csv';
$zonaHoraria     = 'America/Santiago';
$largoTexto      = 300;   // caracteres máximos por consulta
$largoUrl        = 300;
$largoRespuesta  = 150;   // caracteres máximos de la frase de la respuesta
$limitePorHora   = (int) (getenv('PAS_LIMITE') ?: 60); // consultas por hora y por visitante (sin guardar la IP en el CSV)
$separador       = ';';   // punto y coma: Excel en español lo abre en columnas

// ---------- Utilidades ----------
function terminar(int $codigo): never
{
    http_response_code($codigo);
    header('Cache-Control: no-store');
    exit;
}

function origen_de_la_peticion(): string
{
    $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origen === '' && !empty($_SERVER['HTTP_REFERER'])) {
        $p = parse_url($_SERVER['HTTP_REFERER']);
        if (!empty($p['scheme']) && !empty($p['host'])) {
            $origen = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        }
    }
    return strtolower($origen);
}

/** Oculta datos personales evidentes y deja el texto en una sola línea. */
function limpiar_texto(string $texto, int $largo): string
{
    $texto = preg_replace('/[\p{C}]+/u', ' ', $texto) ?? '';
    $texto = trim(preg_replace('/\s+/u', ' ', $texto) ?? '');
    $texto = mb_substr($texto, 0, $largo);

    $texto = preg_replace('/[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+/u', '[correo]', $texto) ?? $texto;
    $texto = preg_replace('~\bhttps?://\S+|\bwww\.\S+~iu', '[enlace]', $texto) ?? $texto;
    $texto = preg_replace('/\b\d{1,2}(?:\.?\d{3}){2}\s*-\s*[\dkK]\b/u', '[rut]', $texto) ?? $texto;
    // Cualquier secuencia con 7 o más dígitos (teléfonos, tarjetas, cuentas), con o sin separadores.
    $texto = preg_replace_callback(
        '/\+?\d[\d\s().\-]{5,}\d/u',
        static fn(array $m): string => strlen(preg_replace('/\D/', '', $m[0]) ?? '') >= 7 ? '[número]' : $m[0],
        $texto
    ) ?? $texto;

    return trim($texto);
}

/** Deja solo origen + ruta (sin parámetros ni #), y solo de los sitios permitidos. */
function limpiar_url(string $url, array $origenes, int $largo): ?string
{
    $p = parse_url(trim($url));
    if (empty($p['scheme']) || empty($p['host']) || !in_array(strtolower($p['scheme']), ['http', 'https'], true)) {
        return null;
    }
    $base = strtolower($p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : ''));
    if (!in_array($base, $origenes, true)) {
        return null;
    }
    $ruta = $p['path'] ?? '/';
    return mb_substr($base . $ruta, 0, $largo);
}

/** Evita que Excel interprete una celda como fórmula. */
function seguro_para_hoja(string $valor): string
{
    return preg_match('/^[=+\-@\t\r]/', $valor) ? "'" . $valor : $valor;
}

/** Límite simple por visitante. Usa un contador temporal (no se guarda en el CSV ni dura más de 2 horas). */
function dentro_del_limite(int $limite, string $sal): bool
{
    $dir = sys_get_temp_dir() . '/pas-limite';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/*') ?: [] as $f) {
            if (@filemtime($f) < time() - 7200) {
                @unlink($f);
            }
        }
    }
    $clave = $dir . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . date('Y-m-d-H') . '|' . $sal);
    $cuenta = is_file($clave) ? (int) file_get_contents($clave) : 0;
    if ($cuenta >= $limite) {
        return false;
    }
    file_put_contents($clave, (string) ($cuenta + 1), LOCK_EX);
    return true;
}

// ---------- Petición ----------
$origen = origen_de_la_peticion();
$permitido = in_array($origen, $origenesPermitidos, true);

if ($permitido) {
    header('Access-Control-Allow-Origin: ' . $origen);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    terminar($permitido ? 204 : 403);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    terminar(405);
}
if (!$permitido) {
    terminar(403);
}

$cuerpo = file_get_contents('php://input', false, null, 0, 4097);
if ($cuerpo === false || strlen($cuerpo) > 4096) {
    terminar(413);
}
$datos = json_decode($cuerpo, true);
if (!is_array($datos)) {
    $datos = $_POST; // también acepta formulario
}
if (!isset($datos['texto'], $datos['url']) || !is_string($datos['texto']) || !is_string($datos['url'])) {
    terminar(400);
}

$texto = limpiar_texto($datos['texto'], $largoTexto);
// Frase de la respuesta (opcional: versiones anteriores del widget no la envían). Pasa por la misma limpieza.
$respuesta = isset($datos['respuesta']) && is_string($datos['respuesta']) ? limpiar_texto($datos['respuesta'], $largoRespuesta) : '';
$url = limpiar_url($datos['url'], $origenesPermitidos, $largoUrl);
if ($url === null) {
    terminar(400);
}
$sinMarcas = trim(preg_replace('/\[(?:correo|enlace|rut|número)\]/u', '', $texto) ?? '');
if (mb_strlen($sinMarcas) < 2) {
    terminar(204); // vacío o solo datos personales: no se guarda nada
}
if (!dentro_del_limite($limitePorHora, $archivo)) {
    terminar(429);
}

// ---------- Guardado ----------
$dir = dirname($archivo);
if (!is_dir($dir)) {
    @mkdir($dir, 0750, true);
    // Que el CSV no se pueda descargar desde la web (Apache). En Nginx, bloquear la carpeta en la configuración.
    @file_put_contents($dir . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    @file_put_contents($dir . '/index.html', '');
}

$nuevo = !is_file($archivo) || filesize($archivo) === 0;
$f = @fopen($archivo, 'ab');
if ($f === false) {
    terminar(500);
}
flock($f, LOCK_EX);
if ($nuevo) {
    fwrite($f, "\xEF\xBB\xBF"); // marca UTF-8 para que Excel muestre bien las tildes
    fputcsv($f, ['FECHA', 'URL', 'TEXTO', 'RESPUESTA'], $separador, '"', '', "\n");
}
$fecha = (new DateTimeImmutable('now', new DateTimeZone($zonaHoraria)))->format('Y-m-d H:i:s');
fputcsv($f, [$fecha, seguro_para_hoja($url), seguro_para_hoja($texto), seguro_para_hoja($respuesta)], $separador, '"', '', "\n");
fflush($f);
flock($f, LOCK_UN);
fclose($f);

terminar(204);
