// Normalización del texto para el buscador.
// Pasos: minúsculas, sin tildes ni signos, diccionario de sinónimos, stopwords y derivación ligera del español.

// Palabras que no aportan al buscar. "no" se conserva: distingue "qué no hacen".
const STOPWORDS = new Set(`
a al algo algun alguna alguno algunos ante antes asi aun aqui bien cada con cual cuales cuando de del desde donde
e el ella ellas ellos en entre era es esa ese eso esta estan estas este esto estos estoy fue ha han hay
la las le les lo los me mas mi mis mucho muy nos o os otra otro para pero poco por porque pues que quien
se sea ser si sin sobre son su sus tal tambien te tan tanto tu tus un una unas uno unos y ya yo
usted ustedes vos favor hola buenas buenos dias tardes noches gracias porfa porfavor ok oye consulta pregunta
saber quisiera queria quiero puedo pueden podrian podria tienen tiene tengo hacen hace hago necesito
como cuanto cuanta cuantos cuantas
`.split(/\s+/).filter(Boolean));

// Diccionario base: variantes ortográficas comunes en español → forma canónica.
// Cada sitio agrega el suyo en el índice (datos.diccionario); una entrada del sitio reemplaza a la base
// y una entrada con valor null o "" la quita.
// Las frases se reemplazan antes que las palabras sueltas. La forma canónica pasa después por la
// derivación, así que basta escribirla una vez.
export const DICCIONARIO_BASE = {
  wasap: 'whatsapp', whatsap: 'whatsapp', guasap: 'whatsapp', 'whats app': 'whatsapp',
  mail: 'correo', email: 'correo', 'e mail': 'correo',
  gratis: 'gratuita', gratuito: 'gratuita', 'sin costo': 'gratuita',
  'inteligencia artificial': 'ia',
};

// Sufijos del español, del más largo al más corto. Derivación ligera: la raíz queda con 4 letras o más.
const SUFIJOS = [
  'aciones', 'amientos', 'imientos', 'amiento', 'imiento', 'adoras', 'adores', 'ciones', 'mente',
  'acion', 'icion', 'adora', 'ador', 'antes', 'ancia', 'encia', 'idades', 'idad', 'ables', 'ibles', 'able', 'ible',
  'istas', 'ista', 'ismos', 'ismo', 'ivas', 'ivos', 'iva', 'ivo', 'osas', 'osos', 'osa', 'oso',
  'amos', 'emos', 'imos', 'ando', 'iendo', 'aron', 'ieron', 'aba', 'aban', 'ado', 'ada', 'ados', 'adas', 'ido', 'ida', 'idos', 'idas',
  'cion', 'ar', 'er', 'ir', 'an', 'en', 'es', 'as', 'os', 'a', 'e', 'o', 's',
];
const RAIZ_MIN = 4;

/** Minúsculas, sin tildes (la ñ pasa a n), sin signos y con espacios simples. */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/(\d)[.,](?=\d{3}\b)/g, '$1') // 21.719 → 21719
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Derivación ligera: quita un sufijo si la raíz queda de RAIZ_MIN letras o más. */
export function raiz(palabra) {
  if (palabra.length <= RAIZ_MIN || /\d/.test(palabra)) return palabra;
  for (const s of SUFIJOS) {
    if (palabra.endsWith(s) && palabra.length - s.length >= RAIZ_MIN) {
      return palabra.slice(0, -s.length);
    }
  }
  return palabra;
}

/**
 * Une el diccionario base con el del sitio y lo deja listo para aplicarse.
 * Las claves y los valores se normalizan, así el sitio puede escribirlos con tildes o mayúsculas.
 */
export function prepararDiccionario(diccionarioSitio = {}, base = DICCIONARIO_BASE) {
  const mapa = new Map();
  for (const fuente of [base, diccionarioSitio ?? {}]) {
    for (const [variante, canonica] of Object.entries(fuente)) {
      const clave = normalizar(variante);
      if (!clave) continue;
      const valor = normalizar(canonica);
      if (valor) mapa.set(clave, valor);
      else mapa.delete(clave);
    }
  }
  const largoMax = Math.max(0, ...[...mapa.keys()].map((k) => k.split(' ').length));
  return { mapa, largoMax };
}

/** Aplica un diccionario preparado sobre una lista de palabras normalizadas, prefiriendo la frase más larga. */
export function aplicarSinonimos(palabras, diccionario) {
  const { mapa, largoMax } = diccionario;
  const salida = [];
  for (let i = 0; i < palabras.length;) {
    let hecho = false;
    for (let n = Math.min(largoMax, palabras.length - i); n >= 1 && !hecho; n--) {
      const frase = palabras.slice(i, i + n).join(' ');
      if (mapa.has(frase)) {
        salida.push(...mapa.get(frase).split(' '));
        i += n;
        hecho = true;
      }
    }
    if (!hecho) salida.push(palabras[i++]);
  }
  return salida;
}

/**
 * Crea la función de términos para un diccionario de sitio.
 * terminos(texto, { sinonimos, stopwords, derivar }) → lista de términos de búsqueda.
 */
export function crearTerminos(diccionarioSitio = {}) {
  const diccionario = prepararDiccionario(diccionarioSitio);
  return function terminos(texto, { sinonimos = true, stopwords = true, derivar = true } = {}) {
    let palabras = normalizar(texto).split(' ').filter(Boolean);
    if (sinonimos) palabras = aplicarSinonimos(palabras, diccionario);
    // Si todo era stopword ("hola", "buenas tardes"), se conservan: son la consulta.
    if (stopwords && palabras.some((p) => !STOPWORDS.has(p))) palabras = palabras.filter((p) => !STOPWORDS.has(p));
    if (derivar) palabras = palabras.map(raiz);
    return palabras;
  };
}

/** Términos con el diccionario base solamente. */
export const terminos = crearTerminos();

/** Trigramas de una palabra con bordes ("crm" → " cr", "crm", "rm "). Base de la tolerancia a errores. */
export function trigramas(palabra) {
  const t = ` ${palabra} `;
  const salida = [];
  for (let i = 0; i + 3 <= t.length; i++) salida.push(t.slice(i, i + 3));
  return salida;
}

export { STOPWORDS };
