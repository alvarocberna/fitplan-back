import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileStorage } from '../../../domain/ports';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;
const S3_MAX_ATTEMPTS = 3;
const S3_CONNECTION_TIMEOUT_MS = 5_000;
const S3_REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class S3FileStorage implements FileStorage {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');
    this.s3 = new S3Client({
      // Explícitos para no depender de los defaults del SDK: hasta 3 intentos por operación y topes
      // de conexión/respuesta, así una subida colgada no bloquea la generación del plan.
      maxAttempts: S3_MAX_ATTEMPTS,
      requestHandler: {
        connectionTimeout: S3_CONNECTION_TIMEOUT_MS,
        requestTimeout: S3_REQUEST_TIMEOUT_MS,
      },
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
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
