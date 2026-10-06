import { CircumferencesEntity } from '../../entities/measurements.entity';
import { CreateCircumferencesDto, UpdateCircumferencesDto } from '../..';

export abstract class CircumferencesDatasource {
  abstract createCircumferences(
    createCircumferencesDto: CreateCircumferencesDto,
  ): Promise<CircumferencesEntity>;
  abstract getCircumferencesById(
    id: string,
  ): Promise<CircumferencesEntity | null>;
  abstract updateCircumferencesById(
    id: string,
    updateCircumferencesDto: UpdateCircumferencesDto,
  ): Promise<CircumferencesEntity>;
  abstract deleteCircumferencesById(id: string): Promise<void>;
}
