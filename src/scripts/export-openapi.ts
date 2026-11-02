import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getMetadataStorage } from 'class-validator';
import { AppModule } from '../app.module';
import { API_PREFIX } from '../common/api-prefix';

// Exporta el contrato HTTP (OpenAPI) a un archivo, sin base de datos, Cognito ni otros servicios: en
// modo `preview` Nest resuelve el grafo de módulos sin instanciar los providers. Los e2e del frontend
// validan contra este archivo las rutas y los bodies que reciben en su backend falso.
// Uso: npm run openapi:export [-- <archivo de salida>]
const DEFAULT_OUTPUT = '../fitplan-front/e2e/contract/openapi.json';

interface ContractSchema {
  required?: string[];
  properties?: Record<string, { nullable?: boolean }>;
}

// Propiedades con @IsOptional() de cada DTO, leídas de los metadatos de class-validator.
function optionalPropertiesByClass(): Map<string, Set<string>> {
  const storage = getMetadataStorage() as unknown as {
    validationMetadatas: Map<
      Function,
      { propertyName: string; type: string }[]
    >;
  };
  const result = new Map<string, Set<string>>();
  for (const [target, metadatas] of storage.validationMetadatas) {
    const optional = metadatas
      .filter((metadata) => metadata.type === 'conditionalValidation')
      .map((metadata) => metadata.propertyName);
    result.set(target.name, new Set(optional));
  }
  return result;
}

// El plugin de Swagger deduce `required` y `nullable` del tipo TypeScript (`goals!: X | null`), que no
// siempre coincide con lo que valida el ValidationPipe. Fuente de verdad: @IsOptional() admite ausente y
// null; sin él, la propiedad es obligatoria y null no pasa sus validadores.
function alignWithValidators(schemas: Record<string, ContractSchema>): void {
  const optionalByClass = optionalPropertiesByClass();
  for (const [name, schema] of Object.entries(schemas)) {
    const optional = optionalByClass.get(name);
    if (!optional) continue;
    const properties = Object.keys(schema.properties ?? {});
    const required = properties.filter((property) => !optional.has(property));
    if (required.length > 0) schema.required = required;
    else delete schema.required;
    for (const property of properties) {
      if (optional.has(property)) schema.properties![property].nullable = true;
      else delete schema.properties![property].nullable;
    }
  }
}

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix(API_PREFIX);
  const config = new DocumentBuilder()
    .setTitle('Fitplan API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  alignWithValidators(
    (document.components?.schemas ?? {}) as Record<string, ContractSchema>,
  );

  const output = resolve(process.argv[2] ?? DEFAULT_OUTPUT);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Contrato exportado en ${output}`);
  await app.close();
}

exportOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
