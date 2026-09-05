import { AnamnesisClinicalEntity } from '../../entities/anamnesis.entity';
import { CreateAnamnesisClinicalDto, UpdateAnamnesisClinicalDto } from '../..';

export abstract class AnamnesisClinicalDatasource {
  abstract createAnamnesisClinical(
    createAnamnesisClinicalDto: CreateAnamnesisClinicalDto,
  ): Promise<AnamnesisClinicalEntity>;
  abstract getAnamnesisClinicalById(
    id: string,
  ): Promise<AnamnesisClinicalEntity | null>;
  abstract updateAnamnesisClinicalById(
    id: string,
    updateAnamnesisClinicalDto: UpdateAnamnesisClinicalDto,
  ): Promise<AnamnesisClinicalEntity>;
  abstract deleteAnamnesisClinicalById(id: string): Promise<void>;
}
