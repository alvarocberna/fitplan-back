import { GoalsEntity } from '../../../entities/anamnesis.entity';

export type CreateGoalsDto = Omit<GoalsEntity, 'id' | 'anamnesis'>;
