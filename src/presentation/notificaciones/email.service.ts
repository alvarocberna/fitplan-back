import { Injectable, Logger } from '@nestjs/common';
import { PlanNutricionalDto } from '../../domain';
import { PdfService } from '../pdf/pdf.service';

interface EnvioCorreo {
  correo: string;
  asunto: string;
  cuerpo: string;
  adjunto: Buffer;
  nombreAdjunto: string;
}

// Arma y "envía" el correo con el plan nutricional. El envío real queda stubbeado
// (ver enviarCorreoReal) hasta que se elija un proveedor (SendGrid, SES, Resend, etc.);
// mientras tanto, el resto de la interfaz (asunto, cuerpo, adjunto) ya queda lista.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly pdfService: PdfService) {}

  async enviarPlanPorCorreo(correo: string, plan: PlanNutricionalDto): Promise<void> {
    const { nombre, apellido } = plan.informacion_personal;
    const adjunto = await this.pdfService.generarBuffer(plan);

    await this.enviarCorreoReal({
      correo,
      asunto: 'Tu plan nutricional está listo',
      cuerpo: `Hola ${nombre} ${apellido}, adjuntamos tu plan nutricional personalizado en PDF.`,
      adjunto,
      nombreAdjunto: `plan-nutricional-${nombre}-${apellido}.pdf`,
    });
  }

  // TODO: reemplazar este stub por la integración real con el proveedor de correo elegido.
  private async enviarCorreoReal(envio: EnvioCorreo): Promise<void> {
    this.logger.log(
      `correo simulado enviado a ${envio.correo} (asunto: "${envio.asunto}", adjunto: ${envio.nombreAdjunto}, ${envio.adjunto.length} bytes)`,
    );
  }
}
