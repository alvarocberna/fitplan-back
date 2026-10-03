import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// Un id que llega de afuera se acepta solo si tiene forma razonable: termina en los logs.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

// Id de correlación por request: se toma el que mande el llamador (el frontend genera uno por
// llamada) o se crea uno. Queda en `req.requestId`, vuelve en el header de la respuesta y va en el
// body de todo error y en su línea de log (AllExceptionsFilter).
export function requestIdMiddleware(
  req: Request & { requestId?: string },
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
