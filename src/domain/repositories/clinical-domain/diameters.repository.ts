import { DiametersEntity } from '../../entities/measurements.entity';
import { CreateDiametersDto, UpdateDiametersDto } from '../..';

export abstract class DiametersRepository {
  abstract createDiameters(
    createDiametersDto: CreateDiametersDto,
  ): Promise<DiametersEntity>;
  abstract getDiametersById(id: string): Promise<DiametersEntity | null>;
  abstract updateDiametersById(
    id: string,
    updateDiametersDto: UpdateDiametersDto,
  ): Promise<DiametersEntity>;
  abstract deleteDiametersById(id: string): Promise<void>;
}
