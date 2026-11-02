import { Module } from '@nestjs/common';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/clinical-domain/clinical-domain-repositories.module';
import { FileStorageModule } from '../../infrastructure/storage/s3/s3-file-storage.module';
import { IdentityModule } from '../identity/identity.module';
import { MyConsultationsController } from './my-consultations.controller';
import { ListMyConsultationsUseCase } from './use-cases/list-my-consultations.use-case';
import { GetMyConsultationUseCase } from './use-cases/get-my-consultation.use-case';
import { MyMeasurementsController } from './my-measurements.controller';
import { ListMyMeasurementsUseCase } from './use-cases/list-my-measurements.use-case';
import { GetMyMeasurementUseCase } from './use-cases/get-my-measurement.use-case';
import { RecordMeasurementUseCase } from './use-cases/record-measurement.use-case';
import { UpdateMyMeasurementUseCase } from './use-cases/update-my-measurement.use-case';

// Historial clínico del paciente (EP-CLI): lectura de sus consultas (GET /me/consultations y
// /me/consultations/:id) y sus mediciones (listar, ver, registrar y corregir: /me/measurements). No importa BillingModule: los estados y el pdfKey de la orden se leen vía include desde el
// repositorio de consultas, y la descarga se firma con el helper signPlanFiles
// (billing/order-files.ts, el mismo que usan /orders/:id/status y /me/plans).
@Module({
  imports: [
    ClinicalDomainRepositoriesModule,
    FileStorageModule,
    IdentityModule,
  ],
  controllers: [MyConsultationsController, MyMeasurementsController],
  providers: [
    ListMyConsultationsUseCase,
    GetMyConsultationUseCase,
    ListMyMeasurementsUseCase,
    GetMyMeasurementUseCase,
    RecordMeasurementUseCase,
    UpdateMyMeasurementUseCase,
  ],
})
export class ClinicalModule {}
