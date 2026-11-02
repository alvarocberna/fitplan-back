import {
  strictSchemaViolations,
  validateJsonSchema,
} from '../../../domain/services/llm/json-schema';
import { CLASSIFY_GOAL_SCHEMA, ClassifiedGoal } from './classify-goal.schema';

describe('CLASSIFY_GOAL_SCHEMA', () => {
  it('cumple las reglas del modo estricto y tiene un nombre válido', () => {
    expect(strictSchemaViolations(CLASSIFY_GOAL_SCHEMA.schema)).toEqual([]);
    expect(CLASSIFY_GOAL_SCHEMA.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it('admite solo los tres objetivos (los mismos de plans/generation/schemas/extract-info.schema.ts)', () => {
    const goals: ClassifiedGoal['goal'][] = [
      'definicion',
      'mantencion',
      'volumen',
    ];
    for (const goal of goals) {
      expect(validateJsonSchema({ goal }, CLASSIFY_GOAL_SCHEMA.schema)).toEqual(
        [],
      );
    }
    expect(CLASSIFY_GOAL_SCHEMA.schema.properties?.goal.enum).toEqual(goals);
    expect(
      validateJsonSchema(
        { goal: 'bajar de peso' },
        CLASSIFY_GOAL_SCHEMA.schema,
      ),
    ).toHaveLength(1);
  });
});
