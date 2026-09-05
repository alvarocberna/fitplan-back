import { AnamnesisPsychosocialEntity } from '../../../entities/anamnesis.entity';

export type CreateAnamnesisPsychosocialDto = Omit<
  AnamnesisPsychosocialEntity,
  'id' | 'anamnesis'
>;
