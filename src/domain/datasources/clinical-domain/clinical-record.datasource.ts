import { ClinicalRecordEntity } from '../../entities/clinical-record.entity';
import { CreateClinicalRecordDto, UpdateClinicalRecordDto } from '../..';

export abstract class ClinicalRecordDatasource {
  abstract createClinicalRecord(
    createClinicalRecordDto: CreateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity>;
  abstract getClinicalRecordById(
    id: string,
  ): Promise<ClinicalRecordEntity | null>;
  abstract updateClinicalRecordById(
    id: string,
    updateClinicalRecordDto: UpdateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity>;
  abstract deleteClinicalRecordById(id: string): Promise<void>;

  // patientId es @unique en el schema (un paciente tiene a lo más un ClinicalRecord). Busca por
  // patientId; si no existe, lo crea.
  abstract findOrCreateClinicalRecordByPatientId(
    patientId: string,
  ): Promise<ClinicalRecordEntity>;
}
