import {
  SPORT_SESSIONS,
  getSportSessionRecommendation,
} from './sport-session.service';

describe('SPORT_SESSIONS', () => {
  it('contiene catálogos de entrenamiento y competencia con código único por sesión', () => {
    const allCodes = [
      ...SPORT_SESSIONS.entrenamiento,
      ...SPORT_SESSIONS.competencia,
    ].map((s) => s.code);
    expect(new Set(allCodes).size).toBe(allCodes.length);
    expect(SPORT_SESSIONS.entrenamiento.length).toBeGreaterThan(0);
    expect(SPORT_SESSIONS.competencia.length).toBeGreaterThan(0);
  });
});

describe('getSportSessionRecommendation', () => {
  it('código "001" devuelve la indicación de hidratación simple', () => {
    const rec = getSportSessionRecommendation('001', 45);
    expect(rec).toMatchObject({
      strategy: expect.stringContaining('hidratación'),
      postActivity: null,
    });
  });

  it('código "004" (resistencia corta) reutiliza la misma indicación que "001"', () => {
    expect(getSportSessionRecommendation('004', 30)).toEqual(
      getSportSessionRecommendation('001', 30),
    );
  });

  it('un código desconocido cae al indicador por defecto (indication001)', () => {
    expect(getSportSessionRecommendation('999', 45)).toEqual(
      getSportSessionRecommendation('001', 45),
    );
  });

  it('código "006" arma la recomendación de carbohidratos/hora según la duración', () => {
    // duration=45 -> carbGrPerHour=30 (duration<90), approxDuration=round(45/30)*30/60=1
    const rec = getSportSessionRecommendation('006', 45);
    expect(rec?.duringActivity).toContain('30gr de carbohidratos/hora');
    expect(rec?.duringActivity).toContain(
      '1 gel deportivo de 30gr o 1/2 litro de jugo isotónico',
    );
  });

  it('código "006" con duración >= 120 minutos usa 60gr de carbohidratos/hora', () => {
    const rec = getSportSessionRecommendation('006', 150);
    expect(rec?.duringActivity).toContain('60gr de carbohidratos/hora');
  });
});
