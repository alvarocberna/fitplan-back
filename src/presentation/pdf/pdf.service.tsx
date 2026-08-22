import { Injectable } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { NutritionPlanDto } from '../../domain';
import { NutritionPlanDocument } from './nutrition-plan.document';

// @react-pdf/renderer corre también en Node (no solo en el navegador), por eso el mismo
// documento que arma el PDF en el cliente (features/plan-nutricional/pdf) se replica acá
// para poder adjuntarlo al correo (ver EmailService.sendPlanByEmail).
@Injectable()
export class PdfService {
  async generateBuffer(plan: NutritionPlanDto): Promise<Buffer> {
    return renderToBuffer(<NutritionPlanDocument plan={plan} />);
  }
}
