import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {HttpExceptionFilter} from './presentation/filters/http-exception.filter';
import helmet from 'helmet';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // Cabeceras de seguridad (oculta X-Powered-By, fija X-Content-Type-Options: nosniff, etc.)
  // CSP desactivada aquí: Swagger UI necesita inline scripts/styles y esta API no sirve HTML propio.
  app.use(helmet({ contentSecurityPolicy: false }));
  // Habilitar CORS
  app.enableCors({
    origin: configService.get<string>('URL_FRONTEND'), 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  //habilitamos Prisma Filter personalizado para manejar exceptions de Prisma
  app.useGlobalFilters(new HttpExceptionFilter());
  //habilitamos los pipes de nest para convertir tipos de datos en el DTO
    app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // ignora propiedades que no están en el DTO
      forbidNonWhitelisted: true, 
      transform: true,        // 👈 transforma tipos automáticamente
      transformOptions: {
        enableImplicitConversion: true, // 👈 convierte strings a number/date si el tipo del DTO lo pide
        },
      }),
    );

  //habilitamos Swagger solo fuera de producción
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NutriApp API')
      .setDescription('API del agente conversacional de nutrición')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = configService.get<string>('PORT');
  await app.listen(port ?? 3001)
}
bootstrap();
