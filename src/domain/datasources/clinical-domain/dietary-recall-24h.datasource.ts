import { DietaryRecall24hEntity } from '../../entities/anamnesis.entity';
import { CreateDietaryRecall24hDto, UpdateDietaryRecall24hDto } from '../..';

export abstract class DietaryRecall24hDatasource {
  abstract createDietaryRecall24h(
    createDietaryRecall24hDto: CreateDietaryRecall24hDto,
  ): Promise<DietaryRecall24hEntity>;
  abstract getDietaryRecall24hById(
    id: string,
  ): Promise<DietaryRecall24hEntity | null>;
  abstract updateDietaryRecall24hById(
    id: string,
    updateDietaryRecall24hDto: UpdateDietaryRecall24hDto,
  ): Promise<DietaryRecall24hEntity>;
  abstract deleteDietaryRecall24hById(id: string): Promise<void>;
}
