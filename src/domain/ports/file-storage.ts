// Puerto hacia el almacenamiento de archivos (hoy S3, ver infrastructure/storage/s3). En la base de
// datos solo se guardan keys; los archivos se leen siempre por URL firmada y temporal.
export abstract class FileStorage {
  abstract uploadPdf(buffer: Buffer, key: string): Promise<void>;

  abstract uploadImage(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<void>;

  // Con `downloadFilename` la URL fuerza la descarga con ese nombre; sin él, el archivo se sirve
  // inline.
  abstract getSignedDownloadUrl(
    key: string,
    ttlSeconds?: number,
    options?: { downloadFilename?: string },
  ): Promise<string>;
}
