import { AnamnesisEntity } from '../../entities/anamnesis.entity';
import { CreateAnamnesisDto, UpdateAnamnesisDto } from '../..';

export abstract class AnamnesisRepository {
  abstract createAnamnesis(
    createAnamnesisDto: CreateAnamnesisDto,
  ): Promise<AnamnesisEntity>;
  abstract getAnamnesisById(id: string): Promise<AnamnesisEntity | null>;
  abstract updateAnamnesisById(
    id: string,
    updateAnamnesisDto: UpdateAnamnesisDto,
  ): Promise<AnamnesisEntity>;
  abstract deleteAnamnesisById(id: string): Promise<void>;
}
