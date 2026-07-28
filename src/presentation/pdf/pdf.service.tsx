import { Injectable } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { PlanNutricionalDto } from '../../domain';
import { PlanNutricionalDocument } from './plan-nutricional.document';

// @react-pdf/renderer corre también en Node (no solo en el navegador), por eso el mismo
// documento que arma el PDF en el cliente (features/plan-nutricional/pdf) se replica acá
// para poder adjuntarlo al correo (ver EmailService.enviarPlanPorCorreo).
@Injectable()
export class PdfService {
  async generarBuffer(plan: PlanNutricionalDto): Promise<Buffer> {
    return renderToBuffer(<PlanNutricionalDocument plan={plan} />);
  }
}
