import { Injectable } from '@nestjs/common';
import { AnamnesisPsychosocialRepository } from '../../../../domain/repositories/clinical-domain/anamnesis-psychosocial.repository';
import { AnamnesisPsychosocialDatasource } from '../../../../domain/datasources/clinical-domain/anamnesis-psychosocial.datasource';
import { AnamnesisPsychosocialEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateAnamnesisPsychosocialDto,
  UpdateAnamnesisPsychosocialDto,
} from '../../../../domain';

@Injectable()
export class AnamnesisPsychosocialRepositoryImpl
  implements AnamnesisPsychosocialRepository
{
  constructor(private readonly datasource: AnamnesisPsychosocialDatasource) {}

  createAnamnesisPsychosocial(
    createAnamnesisPsychosocialDto: CreateAnamnesisPsychosocialDto,
  ): Promise<AnamnesisPsychosocialEntity> {
    return this.datasource.createAnamnesisPsychosocial(
      createAnamnesisPsychosocialDto,
    );
  }

  getAnamnesisPsychosocialById(
    id: string,
  ): Promise<AnamnesisPsychosocialEntity | null> {
    return this.datasource.getAnamnesisPsychosocialById(id);
  }

  updateAnamnesisPsychosocialById(
    id: string,
    updateAnamnesisPsychosocialDto: UpdateAnamnesisPsychosocialDto,
  ): Promise<AnamnesisPsychosocialEntity> {
    return this.datasource.updateAnamnesisPsychosocialById(
      id,
      updateAnamnesisPsychosocialDto,
    );
  }

  deleteAnamnesisPsychosocialById(id: string): Promise<void> {
    return this.datasource.deleteAnamnesisPsychosocialById(id);
  }
}
