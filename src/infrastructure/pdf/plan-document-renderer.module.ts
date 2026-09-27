import { Module } from '@nestjs/common';
import { PlanDocumentRenderer } from '../../domain/ports';
import { ReactPdfPlanDocumentRenderer } from './react-pdf-plan-document.renderer';
import { ThumbnailService } from './thumbnail.service';

@Module({
  providers: [
    ThumbnailService,
    { provide: PlanDocumentRenderer, useClass: ReactPdfPlanDocumentRenderer },
  ],
  exports: [PlanDocumentRenderer],
})
export class PlanDocumentRendererModule {}
