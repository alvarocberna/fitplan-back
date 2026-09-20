import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { ThumbnailService } from './thumbnail.service';

@Module({
  providers: [PdfService, ThumbnailService],
  exports: [PdfService, ThumbnailService],
})
export class PdfModule {}
