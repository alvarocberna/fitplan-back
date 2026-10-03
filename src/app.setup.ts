import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { API_PREFIX } from './common/api-prefix';
import { ErrorCode } from './common/errors/error-codes';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

// Aplana los errores de class-validator (incluidos los de objetos anidados) a una lista de textos.
function flattenValidationErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((text) =>
      parent ? `${parent}.${text}` : text,
    );
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

// Configuración HTTP común a la app real (main.ts) y a la de los tests e2e: prefijo, id de
// correlación, validación de entrada y formato de error. Vive acá para que el e2e pruebe exactamente
// lo mismo que corre en producción.
export function configureApp(app: INestApplication): void {
  // Todas las rutas de la API cuelgan de /api/v1 (Swagger queda fuera, en /api-docs).
  app.setGlobalPrefix(API_PREFIX);
  app.use(requestIdMiddleware);
  // Formato único de error para toda excepción (HttpException, Prisma, proveedores, inesperadas).
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ignora propiedades que no están en el DTO
      forbidNonWhitelisted: true,
      transform: true, // transforma tipos automáticamente
      transformOptions: {
        enableImplicitConversion: true, // convierte strings a number/date si el tipo del DTO lo pide
      },
      // `message` siempre es un string para el usuario; el detalle por campo va en `errors`.
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Los datos enviados no son válidos',
          errors: flattenValidationErrors(errors),
        }),
    }),
  );
}
