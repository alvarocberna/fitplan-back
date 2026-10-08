// Códigos estables del contrato de error de la API (campo `code` de la respuesta). El frontend decide
// por `code`/`statusCode`, nunca comparando el texto de `message`.
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  IDENTITY_NOT_SYNCED: 'IDENTITY_NOT_SYNCED',
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ORDER_EXPIRED: 'ORDER_EXPIRED',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  GOAL_NOT_FEASIBLE: 'GOAL_NOT_FEASIBLE',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
  PAYMENT_UNAVAILABLE: 'PAYMENT_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Código por defecto de una HttpException que no trae uno propio.
export function errorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHENTICATED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 413:
      return ErrorCode.PAYLOAD_TOO_LARGE;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
  }
}

// Mensaje por defecto (en español) cuando la excepción no trae uno pensado para el usuario.
export function defaultMessageFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'La solicitud no es válida';
    case 401:
      return 'Debes iniciar sesión para continuar';
    case 403:
      return 'No tienes permiso para realizar esta acción';
    case 404:
      return 'No encontramos lo que buscas';
    case 409:
      return 'La operación no se pudo completar por un conflicto con el estado actual';
    case 413:
      return 'La solicitud es demasiado grande';
    case 429:
      return 'Hiciste demasiadas solicitudes en poco tiempo. Espera un momento e intenta nuevamente.';
    case 503:
      return 'El servicio no está disponible en este momento. Intenta nuevamente en unos minutos.';
    default:
      return status >= 500
        ? 'Ocurrió un error inesperado. Intenta nuevamente.'
        : 'La solicitud no es válida';
  }
}
