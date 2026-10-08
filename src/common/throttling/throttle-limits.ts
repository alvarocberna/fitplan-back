// Límites de frecuencia de la API, en un solo lugar. Cada límite se cuenta por (endpoint, usuario):
// la clave es el `sub` del token o, sin token, la IP (ver UserThrottlerGuard).
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Nombres de los dos contadores que lleva cada endpoint: una ventana corta y una diaria.
export const THROTTLE_SHORT = 'default';
export const THROTTLE_DAILY = 'daily';

// Por defecto, para todo endpoint que no declare otra cosa.
export const DEFAULT_THROTTLERS = [
  { name: THROTTLE_SHORT, ttl: MINUTE_MS, limit: 120 },
  { name: THROTTLE_DAILY, ttl: DAY_MS, limit: 20_000 },
];

// Endpoints que llaman al modelo de lenguaje: cada llamada cuesta dinero.
export const LLM_THROTTLE = {
  [THROTTLE_SHORT]: { ttl: MINUTE_MS, limit: 20 },
  [THROTTLE_DAILY]: { ttl: DAY_MS, limit: 300 },
};

// Creación de órdenes/consultas y pagos: nadie legítimo hace más de unas pocas por minuto.
export const ORDER_THROTTLE = {
  [THROTTLE_SHORT]: { ttl: MINUTE_MS, limit: 10 },
  [THROTTLE_DAILY]: { ttl: DAY_MS, limit: 200 },
};

// Retorno de la pasarela de pago: lo llama el servidor del frontend, sin token (una sola IP de origen
// para todos los usuarios).
export const PAYMENT_RETURN_THROTTLE = {
  [THROTTLE_SHORT]: { ttl: MINUTE_MS, limit: 60 },
  [THROTTLE_DAILY]: { ttl: DAY_MS, limit: 20_000 },
};
