import { Module } from '@nestjs/common';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/clinical-domain/clinical-domain-repositories.module';
import { FileStorageModule } from '../../infrastructure/storage/s3/s3-file-storage.module';
import { IdentityModule } from '../identity/identity.module';
import { MyConsultationsController } from './my-consultations.controller';
import { ListMyConsultationsUseCase } from './use-cases/list-my-consultations.use-case';
import { GetMyConsultationUseCase } from './use-cases/get-my-consultation.use-case';

// Historial clínico del paciente (EP-CLI). Por ahora solo la lectura de sus consultas
// (GET /me/consultations y /me/consultations/:id); las mediciones (/me/measurements) se agregan
// acá. No importa BillingModule: los estados y el pdfKey de la orden se leen vía include desde el
// repositorio de consultas, y la descarga se firma con el helper signPlanFiles
// (billing/order-files.ts, el mismo que usan /orders/:id/status y /me/plans).
@Module({
  imports: [ClinicalDomainRepositoriesModule, FileStorageModule, IdentityModule],
  controllers: [MyConsultationsController],
  providers: [ListMyConsultationsUseCase, GetMyConsultationUseCase],
})
export class ClinicalModule {}
