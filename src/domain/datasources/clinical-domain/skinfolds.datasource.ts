import { SkinfoldsEntity } from '../../entities/measurements.entity';
import { CreateSkinfoldsDto, UpdateSkinfoldsDto } from '../..';

export abstract class SkinfoldsDatasource {
  abstract createSkinfolds(
    createSkinfoldsDto: CreateSkinfoldsDto,
  ): Promise<SkinfoldsEntity>;
  abstract getSkinfoldsById(id: string): Promise<SkinfoldsEntity | null>;
  abstract updateSkinfoldsById(
    id: string,
    updateSkinfoldsDto: UpdateSkinfoldsDto,
  ): Promise<SkinfoldsEntity>;
  abstract deleteSkinfoldsById(id: string): Promise<void>;
}
