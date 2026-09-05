import { AnamnesisDietaryEntity } from '../../entities/anamnesis.entity';
import { CreateAnamnesisDietaryDto, UpdateAnamnesisDietaryDto } from '../..';

export abstract class AnamnesisDietaryRepository {
  abstract createAnamnesisDietary(
    createAnamnesisDietaryDto: CreateAnamnesisDietaryDto,
  ): Promise<AnamnesisDietaryEntity>;
  abstract getAnamnesisDietaryById(
    id: string,
  ): Promise<AnamnesisDietaryEntity | null>;
  abstract updateAnamnesisDietaryById(
    id: string,
    updateAnamnesisDietaryDto: UpdateAnamnesisDietaryDto,
  ): Promise<AnamnesisDietaryEntity>;
  abstract deleteAnamnesisDietaryById(id: string): Promise<void>;
}
