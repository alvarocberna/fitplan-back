import {
  GENERATION_RETRY_DELAYS_MS,
  MAX_GENERATION_ROUNDS,
  isGenerationRetryPending,
} from './generation-retry.policy';

describe('generation-retry.policy', () => {
  it('3 reintentos con esperas de 15 min, 1 h y 4 h: 4 rondas en total', () => {
    expect(GENERATION_RETRY_DELAYS_MS).toEqual([
      900_000, 3_600_000, 14_400_000,
    ]);
    expect(MAX_GENERATION_ROUNDS).toBe(4);
  });

  it.each([1, 2, 3])(
    'ERROR con %i ronda(s) fallida(s): aún quedan reintentos',
    (attempts) => {
      expect(
        isGenerationRetryPending({ generationStatus: 'ERROR', attempts }),
      ).toBe(true);
    },
  );

  it('ERROR con las 4 rondas agotadas: es definitivo', () => {
    expect(
      isGenerationRetryPending({ generationStatus: 'ERROR', attempts: 4 }),
    ).toBe(false);
  });

  it.each(['NOT_STARTED', 'GENERATING', 'COMPLETED'] as const)(
    '%s nunca cuenta como reintento pendiente',
    (generationStatus) => {
      expect(isGenerationRetryPending({ generationStatus, attempts: 1 })).toBe(
        false,
      );
    },
  );
});
