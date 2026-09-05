import { SupplementsEntity } from '../../entities/anamnesis.entity';
import { CreateSupplementsDto, UpdateSupplementsDto } from '../..';

export abstract class SupplementsRepository {
  abstract createSupplements(
    createSupplementsDto: CreateSupplementsDto,
  ): Promise<SupplementsEntity>;
  abstract getSupplementsById(id: string): Promise<SupplementsEntity | null>;
  abstract updateSupplementsById(
    id: string,
    updateSupplementsDto: UpdateSupplementsDto,
  ): Promise<SupplementsEntity>;
  abstract deleteSupplementsById(id: string): Promise<void>;
}
