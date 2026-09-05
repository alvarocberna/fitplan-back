import { LifestyleEntity } from '../../entities/anamnesis.entity';
import { CreateLifestyleDto, UpdateLifestyleDto } from '../..';

export abstract class LifestyleDatasource {
  abstract createLifestyle(
    createLifestyleDto: CreateLifestyleDto,
  ): Promise<LifestyleEntity>;
  abstract getLifestyleById(id: string): Promise<LifestyleEntity | null>;
  abstract updateLifestyleById(
    id: string,
    updateLifestyleDto: UpdateLifestyleDto,
  ): Promise<LifestyleEntity>;
  abstract deleteLifestyleById(id: string): Promise<void>;
}
