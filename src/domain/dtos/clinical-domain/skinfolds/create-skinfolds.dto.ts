import { SkinfoldsEntity } from '../../../entities/measurements.entity';

export type CreateSkinfoldsDto = Omit<SkinfoldsEntity, 'id' | 'measurements'>;
