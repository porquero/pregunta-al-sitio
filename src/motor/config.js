// Valores por defecto del motor. Cada sitio puede reemplazarlos en el índice (datos.config),
// normalmente con lo que escribe la calibración.

// Parámetros del buscador BM25F.
export const MOTOR = {
  k1: 1.6,
  pesos: { titulo: 2, preguntas: 1.5, keywords: 3, sinonimos: 2 },
  similitudMin: 0.5,
  frase: 0.5,
};

// Umbrales de las zonas de confianza: T puntaje normalizado, C cobertura, M margen; a alta, m media.
export const ZONAS = { Ta: 0.5, Ca: 0.5, Ma: 0, Tm: 0.3, Cm: 0.2 };

// Zona media: cuántos nodos se ofrecen en "¿Te refieres a A o B?".
export const OPCIONES_MEDIA = 2;

// Chat.
// Tiempo mínimo del indicador de escritura antes de cada respuesta.
export const RETARDO_MS = 1000;
// Sesión en localStorage. Cambiar la versión de la clave descarta las conversaciones guardadas.
export const CLAVE_SESION = 'pregunta-al-sitio.v1';
// Máximo de eventos guardados: se conservan los más recientes.
export const MAX_EVENTOS = 200;
