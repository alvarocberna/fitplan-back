import { Injectable } from '@nestjs/common';
import { ClinicalConditionRepository } from '../../../../domain/repositories/clinical-domain/clinical-condition.repository';
import { ClinicalConditionDatasource } from '../../../../domain/datasources/clinical-domain/clinical-condition.datasource';
import { ClinicalConditionEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateClinicalConditionDto,
  UpdateClinicalConditionDto,
} from '../../../../domain';

@Injectable()
export class ClinicalConditionRepositoryImpl
  implements ClinicalConditionRepository
{
  constructor(private readonly datasource: ClinicalConditionDatasource) {}

  createClinicalCondition(
    createClinicalConditionDto: CreateClinicalConditionDto,
  ): Promise<ClinicalConditionEntity> {
    return this.datasource.createClinicalCondition(createClinicalConditionDto);
  }

  getClinicalConditionById(
    id: string,
  ): Promise<ClinicalConditionEntity | null> {
    return this.datasource.getClinicalConditionById(id);
  }

  updateClinicalConditionById(
    id: string,
    updateClinicalConditionDto: UpdateClinicalConditionDto,
  ): Promise<ClinicalConditionEntity> {
    return this.datasource.updateClinicalConditionById(
      id,
      updateClinicalConditionDto,
    );
  }

  deleteClinicalConditionById(id: string): Promise<void> {
    return this.datasource.deleteClinicalConditionById(id);
  }
}
