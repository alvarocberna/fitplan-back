import { AnamnesisPsychosocialEntity } from '../../entities/anamnesis.entity';
import {
  CreateAnamnesisPsychosocialDto,
  UpdateAnamnesisPsychosocialDto,
} from '../..';

export abstract class AnamnesisPsychosocialDatasource {
  abstract createAnamnesisPsychosocial(
    createAnamnesisPsychosocialDto: CreateAnamnesisPsychosocialDto,
  ): Promise<AnamnesisPsychosocialEntity>;
  abstract getAnamnesisPsychosocialById(
    id: string,
  ): Promise<AnamnesisPsychosocialEntity | null>;
  abstract updateAnamnesisPsychosocialById(
    id: string,
    updateAnamnesisPsychosocialDto: UpdateAnamnesisPsychosocialDto,
  ): Promise<AnamnesisPsychosocialEntity>;
  abstract deleteAnamnesisPsychosocialById(id: string): Promise<void>;
}
