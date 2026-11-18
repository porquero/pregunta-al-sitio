// Servidor de desarrollo: sirve el repo y recibe el webhook de contacto de prueba.
//   npm run dev  → http://localhost:5178/dev/
// POST /dev/webhook guarda cada envío en memoria; GET /dev/webhook los devuelve.
// Solo para probar el widget en local; no es parte del paquete.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const PUERTO = Number(process.env.PORT ?? 5178);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const recibidos = [];

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/dev/webhook') {
    if (req.method === 'POST') {
      let cuerpo = '';
      for await (const parte of req) cuerpo += parte;
      recibidos.push({ tipo: req.headers['content-type'], cuerpo });
      console.log('webhook', req.headers['content-type'], cuerpo);
      res.writeHead(url.searchParams.has('fallar') ? 500 : 200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":true}');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(recibidos));
  }
  let ruta = decodeURIComponent(url.pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = normalize(join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ.replace(/[\\/]$/, '') + sep) || archivo.includes(`${sep}node_modules${sep}`)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(datos);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`http://localhost:${PUERTO}/dev/`));
