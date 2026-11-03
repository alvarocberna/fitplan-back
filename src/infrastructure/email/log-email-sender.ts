import { Injectable, Logger } from '@nestjs/common';
import { NutritionPlanDto } from '../../domain';
import { EmailSender } from '../../domain/ports';

interface EmailDelivery {
  email: string;
  subject: string;
  body: string;
  attachment: Buffer;
  attachmentName: string;
}

// Arma y "envía" el correo con el plan nutricional. El envío real queda stubbeado
// (ver sendRealEmail) hasta que se elija un proveedor (SendGrid, SES, Resend, etc.);
// mientras tanto, el resto de la interfaz (asunto, cuerpo, adjunto) ya queda lista.
@Injectable()
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger(LogEmailSender.name);

  // El PDF ya lo generó y subió a S3 GeneratePersonalizedPlanUseCase;
  // se recibe ya armado acá para no generarlo dos veces.
  async sendPlanByEmail(
    email: string,
    plan: NutritionPlanDto,
    attachment: Buffer,
  ): Promise<void> {
    const { name, lastName } = plan.personalInfo;

    await this.sendRealEmail({
      email,
      subject: 'Tu plan nutricional está listo',
      body: `Hola ${name} ${lastName}, adjuntamos tu plan nutricional personalizado en PDF.`,
      attachment,
      attachmentName: `plan-nutricional-${name}-${lastName}.pdf`,
    });
  }

  // TODO: reemplazar este stub por la integración real con el proveedor de correo elegido.
  private sendRealEmail(delivery: EmailDelivery): Promise<void> {
    this.logger.log(
      `correo simulado enviado a ${delivery.email} (asunto: "${delivery.subject}", adjunto: ${delivery.attachmentName}, ${delivery.attachment.length} bytes)`,
    );
    return Promise.resolve();
  }
}
