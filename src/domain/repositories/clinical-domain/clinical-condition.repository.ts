import { ClinicalConditionEntity } from '../../entities/anamnesis.entity';
import { CreateClinicalConditionDto, UpdateClinicalConditionDto } from '../..';

export abstract class ClinicalConditionRepository {
  abstract createClinicalCondition(
    createClinicalConditionDto: CreateClinicalConditionDto,
  ): Promise<ClinicalConditionEntity>;
  abstract getClinicalConditionById(
    id: string,
  ): Promise<ClinicalConditionEntity | null>;
  abstract updateClinicalConditionById(
    id: string,
    updateClinicalConditionDto: UpdateClinicalConditionDto,
  ): Promise<ClinicalConditionEntity>;
  abstract deleteClinicalConditionById(id: string): Promise<void>;
}
