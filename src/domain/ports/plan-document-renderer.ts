import { NutritionPlanDto } from '../dtos/nutrition-plan.dto';

// Puerto hacia el render del documento del plan (hoy @react-pdf/renderer + pdfjs, ver
// infrastructure/pdf).
export abstract class PlanDocumentRenderer {
  abstract renderPdf(plan: NutritionPlanDto): Promise<Buffer>;

  // Miniatura WebP de la página 1 del PDF. Puede lanzar: el llamador decide si el fallo es fatal.
  abstract renderThumbnail(pdfBuffer: Buffer): Promise<Buffer>;
}
