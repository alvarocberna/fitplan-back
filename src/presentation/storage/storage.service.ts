import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Carpetas del bucket S3 (ver doc/architecture/deployment-architecture.md y
// doc/flows/purchase-flow.md): "productos-personalizados" son los planes generados por consulta
// (uno por Order), "productos-estandarizados" son planes fijos subidos manualmente (pendiente,
// no implementado todavía).
export const PERSONALIZED_PLANS_PREFIX = 'productos-personalizados';

export function buildPersonalizedPlanKey(orderId: string): string {
  return `${PERSONALIZED_PLANS_PREFIX}/${orderId}.pdf`;
}

// Miniatura WebP de la página 1 del PDF de una Order (vista previa del panel del frontend).
export function buildPlanThumbnailKey(orderId: string): string {
  return `${PERSONALIZED_PLANS_PREFIX}/miniaturas/${orderId}.webp`;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');
    this.s3 = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId:
          this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async uploadPdf(buffer: Buffer, key: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );
  }

  async uploadImage(
    buffer: Buffer,
    key: string,
    contentType = 'image/webp',
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  // El bucket es privado (sin acceso público): esta URL firmada es la única forma de leer el
  // objeto, expira en `ttlSeconds` y nunca se persiste (se genera on-demand en cada solicitud, ver
  // doc/security/deployment-security.md sección 10).
  // Con `downloadFilename`, S3 responde con `Content-Disposition: attachment`, lo que fuerza la
  // descarga (el atributo `download` de un <a> se ignora en cross-origin) y fija el nombre del
  // archivo. Sin él, el objeto se sirve inline (p. ej. para el <iframe> de /ordenes/[id]).
  async getSignedDownloadUrl(
    key: string,
    ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
    options: { downloadFilename?: string } = {},
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options.downloadFilename && {
        ResponseContentDisposition: `attachment; filename="${options.downloadFilename}"`,
      }),
    });
    return getSignedUrl(this.s3, command, { expiresIn: ttlSeconds });
  }
}
