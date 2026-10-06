import { Module } from '@nestjs/common';
import { FileStorage } from '../../../domain/ports';
import { S3FileStorage } from './s3-file-storage';

@Module({
  providers: [{ provide: FileStorage, useClass: S3FileStorage }],
  exports: [FileStorage],
})
export class FileStorageModule {}
