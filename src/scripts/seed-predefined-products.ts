// Carga (o sincroniza) el catálogo de planes predefinidos: una fila `product` por cada una de las 112
// versiones (4 planes × 7 rangos de peso × 2 sexos × 2 grupos de edad, ver predefined-plan-code.ts).
//
//   npm run seed:predefined                  # verifica en S3 qué archivos existen
//   npm run seed:predefined -- --no-verify   # sin tocar S3 (filas nuevas quedan inactivas)
//   npm run seed:predefined -- --dry-run     # solo muestra qué haría, sin escribir en la base
//
// Es idempotente (upsert por `code`), se puede volver a correr cada vez que se suban más PDFs:
//  - Filas nuevas: se crean con nombre, descripción y precio por defecto (placeholders, ver
//    predefined-products.seed-data.ts).
//  - Filas existentes: solo se sincronizan pdf_key, thumbnail_key y active. Nombre, descripción y
//    precio NO se pisan, así que los ajustes manuales sobreviven.
//  - Con verificación, `active` = el PDF existe en S3 (y thumbnail_key = null si falta la miniatura,
//    para no mostrar una imagen rota). Sin verificación no se toca `active` de filas existentes.
//
// Verificar requiere las credenciales AWS del .env (AWS_REGION, AWS_S3_BUCKET_NAME,
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY), las mismas que usa StorageService.
import 'dotenv/config';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '../../generated/prisma';
import {
  buildAllPredefinedProductSeedRows,
  PredefinedProductSeedRow,
} from './predefined-products.seed-data';

const BATCH_SIZE = 10;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

// 404 => no existe. Cualquier otro error (403 por credenciales/permisos, red, etc.) se propaga en
// vez de interpretarse como "no existe": si no, un problema de credenciales desactivaría todo el
// catálogo en silencio.
async function objectExists(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function inBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    results.push(...(await Promise.all(items.slice(i, i + BATCH_SIZE).map(fn))));
  }
  return results;
}

interface RowStatus {
  row: PredefinedProductSeedRow;
  pdfExists: boolean | null; // null = no se verificó
  thumbnailExists: boolean | null;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const verify = !args.has('--no-verify');
  const dryRun = args.has('--dry-run');
  const rows = buildAllPredefinedProductSeedRows();

  let statuses: RowStatus[];
  if (verify) {
    const bucket = requireEnv('AWS_S3_BUCKET_NAME');
    const s3 = new S3Client({
      region: requireEnv('AWS_REGION'),
      credentials: {
        accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
      },
    });
    console.log(`Verificando ${rows.length * 2} objetos en s3://${bucket} ...`);
    statuses = await inBatches(rows, async (row) => ({
      row,
      pdfExists: await objectExists(s3, bucket, row.pdfKey),
      thumbnailExists: await objectExists(s3, bucket, row.thumbnailKey),
    }));
  } else {
    statuses = rows.map((row) => ({ row, pdfExists: null, thumbnailExists: null }));
  }

  const missingPdfs = statuses.filter((s) => s.pdfExists === false);
  const missingThumbnails = statuses.filter((s) => s.thumbnailExists === false);

  if (dryRun) {
    console.log(`[dry-run] ${rows.length} versiones; no se escribió nada en la base de datos.`);
  } else {
    const prisma = new PrismaClient();
    try {
      let created = 0;
      let updated = 0;
      for (const { row, pdfExists, thumbnailExists } of statuses) {
        const thumbnailKey = thumbnailExists === false ? null : row.thumbnailKey;
        const existing = await prisma.product.findUnique({
          where: { code: row.code },
          select: { id: true },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              pdfKey: row.pdfKey,
              thumbnailKey,
              ...(pdfExists === null ? {} : { active: pdfExists }),
            },
          });
          updated++;
        } else {
          await prisma.product.create({
            data: {
              type: 'PREDEFINED',
              code: row.code,
              name: row.name,
              description: row.description,
              price: row.price,
              currency: row.currency,
              pdfKey: row.pdfKey,
              thumbnailKey,
              // sin verificar no se sabe si el PDF existe: nace inactivo (se activa al correr
              // el seed con verificación, o a mano) para no vender algo que no se puede entregar.
              active: pdfExists === true,
            },
          });
          created++;
        }
      }
      console.log(`Filas creadas: ${created}, actualizadas: ${updated}.`);
    } finally {
      await prisma.$disconnect();
    }
  }

  if (verify) {
    console.log(`Con PDF en S3 (activas): ${rows.length - missingPdfs.length}/${rows.length}`);
    console.log(`Sin PDF (inactivas): ${missingPdfs.length}`);
    console.log(`Sin miniatura (thumbnail_key = null): ${missingThumbnails.length}`);
  } else if (!dryRun) {
    console.log('Sin verificación en S3: las filas nuevas quedaron inactivas (active = false).');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
