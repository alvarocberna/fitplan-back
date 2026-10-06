import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { configureApp } from './app.setup';
import { getCognitoVerifier } from './infrastructure/auth/cognito/cognito-verifier';

const logger = new Logger('Bootstrap');

// Una promesa rechazada que nadie atendió no debe pasar en silencio: se registra con su stack. No se
// corta el proceso (los puntos de entrada en segundo plano ya contienen sus errores; esto es la red).
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(`Promesa rechazada sin atender: ${error.message}`, error.stack);
});

// Tras una excepción no capturada el estado del proceso no es confiable: se registra y se termina,
// para que el orquestador lo reinicie.
process.on('uncaughtException', (error) => {
  logger.error(`Excepción no capturada: ${error.message}`, error.stack);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  // Detrás de un reverse proxy (Nginx / load balancer): la IP del cliente es la de X-Forwarded-For
  // del primer salto. La usa el rate limiting cuando la request no trae token.
  app.set('trust proxy', 1);
  // Cabeceras de seguridad (oculta X-Powered-By, fija X-Content-Type-Options: nosniff, etc.)
  // CSP desactivada aquí: Swagger UI necesita inline scripts/styles y esta API no sirve HTML propio.
  app.use(helmet({ contentSecurityPolicy: false }));
  // CORS: solo el origen del frontend. Sin URL_FRONTEND, `origin: undefined` dejaría pasar cualquier
  // origen, así que en producción es obligatoria. No se usan cookies contra esta API (la sesión viaja
  // como Authorization: Bearer desde el servidor de Next): credentials queda en false.
  const frontendOrigin = configService.get<string>('URL_FRONTEND');
  if (!frontendOrigin && isProduction) {
    throw new Error('Falta la variable de entorno URL_FRONTEND (origen permitido por CORS)');
  }
  app.enableCors({
    origin: frontendOrigin ?? false,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id'],
    credentials: false,
  });
  // prefijo /api/v1, id de correlación, ValidationPipe y filtro global de excepciones
  configureApp(app);
  // Falla al arrancar (y no en la primera request, disfrazado de 401) si falta la config de Cognito.
  getCognitoVerifier();
  // Para que onModuleDestroy (PrismaService.$disconnect) corra ante SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // Swagger es opt-in (ENABLE_SWAGGER=true) y nunca en producción: describe toda la API, y antes
  // quedaba expuesto si NODE_ENV no estaba seteado en el ambiente desplegado.
  if (configService.get<string>('ENABLE_SWAGGER') === 'true' && !isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NutriApp API')
      .setDescription('API del agente conversacional de nutrición')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = configService.get<string>('PORT');
  await app.listen(port ?? 3001);
}

bootstrap().catch((error: Error) => {
  logger.error(`No se pudo iniciar la aplicación: ${error.message}`, error.stack);
  process.exit(1);
});
