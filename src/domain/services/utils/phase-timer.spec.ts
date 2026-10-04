import { aggregatePhases, PhaseTimer, summarizePhases } from './phase-timer';

// reloj falso: cada lectura devuelve el siguiente valor de la lista
function clock(...readings: number[]) {
  let index = 0;
  return () => readings[Math.min(index++, readings.length - 1)];
}

describe('PhaseTimer', () => {
  it('mide una fase asíncrona y devuelve el resultado de la función', async () => {
    const timer = new PhaseTimer(clock(0, 250));

    const result = await timer.measure('llm_plan', async () => 'plan');

    expect(result).toBe('plan');
    expect(timer.entries()).toEqual([{ phase: 'llm_plan', durationMs: 250, ok: true }]);
  });

  it('mide también una función síncrona', async () => {
    const timer = new PhaseTimer(clock(10, 15));

    await expect(timer.measure('validate', () => 42)).resolves.toBe(42);
    expect(timer.entries()[0]).toMatchObject({ phase: 'validate', durationMs: 5 });
  });

  it('registra la fase como fallida (ok: false) y propaga el error', async () => {
    const timer = new PhaseTimer(clock(0, 1200));

    await expect(
      timer.measure('upload_pdf', async () => {
        throw new Error('S3 caído');
      }),
    ).rejects.toThrow('S3 caído');
    expect(timer.entries()).toEqual([{ phase: 'upload_pdf', durationMs: 1200, ok: false }]);
  });

  it('avisa cada medición al callback, también cuando la fase falla', async () => {
    const timer = new PhaseTimer(clock(0, 10, 10, 30));
    const onDone = jest.fn();

    await timer.measure('a', () => 1, onDone);
    await timer.measure('b', () => Promise.reject(new Error('x')), onDone).catch(() => undefined);

    expect(onDone.mock.calls.map(([entry]) => entry)).toEqual([
      { phase: 'a', durationMs: 10, ok: true },
      { phase: 'b', durationMs: 20, ok: false },
    ]);
  });

  it('record() registra una duración externa, con datos, y nunca negativa', () => {
    const timer = new PhaseTimer();

    timer.record('queue_wait', 3200.4, { trigger: 'payment' });
    timer.record('reloj_desfasado', -50);

    expect(timer.entries()).toEqual([
      { phase: 'queue_wait', durationMs: 3200, ok: true, data: { trigger: 'payment' } },
      { phase: 'reloj_desfasado', durationMs: 0, ok: true },
    ]);
  });

  describe('annotate()', () => {
    it('datos anotados MIENTRAS la fase corre quedan en esa medición (métricas del modelo)', async () => {
      const timer = new PhaseTimer(clock(0, 900));

      await timer.measure('llm_plan', async () => {
        timer.annotate('llm_plan', { promptTokens: 9000 });
        timer.annotate('llm_plan', { completionTokens: 6000 });
      });

      expect(timer.entries()[0].data).toEqual({ promptTokens: 9000, completionTokens: 6000 });
    });

    it('datos anotados DESPUÉS se agregan a la última medición de esa fase', async () => {
      const timer = new PhaseTimer();
      await timer.measure('render_pdf', () => undefined);

      timer.annotate('render_pdf', { bytes: 48_000 });

      expect(timer.entries()[0].data).toEqual({ bytes: 48_000 });
    });

    it('no mezcla datos entre dos mediciones de la misma fase', async () => {
      const timer = new PhaseTimer();
      await timer.measure('llm_plan', async () => timer.annotate('llm_plan', { promptTokens: 1 }));
      await timer.measure('llm_plan', async () => timer.annotate('llm_plan', { promptTokens: 2 }));

      expect(timer.entries().map((entry) => entry.data)).toEqual([
        { promptTokens: 1 },
        { promptTokens: 2 },
      ]);
    });

    it('anotar una fase que no existe no hace nada', () => {
      const timer = new PhaseTimer();

      expect(() => timer.annotate('fantasma', { x: 1 })).not.toThrow();
      expect(timer.entries()).toEqual([]);
    });
  });

  it('summary(): total, porcentaje de cada fase y la más lenta', async () => {
    const timer = new PhaseTimer(clock(0, 100, 100, 1000, 1000, 1000));
    await timer.measure('calculate', () => undefined); // 100
    await timer.measure('llm_plan', () => undefined); // 900
    await timer.measure('merge', () => undefined); // 0

    expect(timer.summary()).toEqual({
      totalMs: 1000,
      slowest: 'llm_plan',
      phases: [
        { phase: 'calculate', durationMs: 100, ok: true, pct: 10 },
        { phase: 'llm_plan', durationMs: 900, ok: true, pct: 90 },
        { phase: 'merge', durationMs: 0, ok: true, pct: 0 },
      ],
    });
    expect(timer.totalMs()).toBe(1000);
    expect(timer.totalMsOf((phase) => phase.startsWith('llm_'))).toBe(900);
  });

  it('summary() sin mediciones no divide por cero', () => {
    expect(new PhaseTimer().summary()).toEqual({ totalMs: 0, phases: [], slowest: null });
  });
});

describe('summarizePhases / aggregatePhases', () => {
  const entries = [
    { phase: 'llm_plan', durationMs: 600, ok: false },
    { phase: 'backoff', durationMs: 100, ok: true },
    { phase: 'llm_plan', durationMs: 300, ok: true },
  ];

  it('la fase más lenta es la que más tiempo ACUMULÓ entre todos los intentos', () => {
    expect(summarizePhases(entries).slowest).toBe('llm_plan');
    expect(summarizePhases(entries).totalMs).toBe(1000);
  });

  it('aggregatePhases suma por nombre de fase y ordena de mayor a menor', () => {
    expect(aggregatePhases(entries)).toEqual([
      { phase: 'llm_plan', durationMs: 900, pct: 90, count: 2 },
      { phase: 'backoff', durationMs: 100, pct: 10, count: 1 },
    ]);
  });
});
