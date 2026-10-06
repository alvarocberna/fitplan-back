import { Injectable } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { NutritionPlanDto } from '../../domain';
import { PlanDocumentRenderer } from '../../domain/ports';
import { NutritionPlanDocument } from './nutrition-plan.document';
import { ThumbnailService } from './thumbnail.service';

// @react-pdf/renderer corre también en Node (no solo en el navegador), por eso el mismo
// documento que arma el PDF en el cliente (features/nutrition-plan/pdf del frontend) se replica acá
// para poder adjuntarlo al correo (ver EmailSender.sendPlanByEmail).
@Injectable()
export class ReactPdfPlanDocumentRenderer implements PlanDocumentRenderer {
  constructor(private readonly thumbnailService: ThumbnailService) {}

  async renderPdf(plan: NutritionPlanDto): Promise<Buffer> {
    return renderToBuffer(<NutritionPlanDocument plan={plan} />);
  }

  renderThumbnail(pdfBuffer: Buffer): Promise<Buffer> {
    return this.thumbnailService.generateFirstPage(pdfBuffer);
  }
}
