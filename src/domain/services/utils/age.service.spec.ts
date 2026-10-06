import { calculateAge } from './age.service';

describe('calculateAge', () => {
  const realDate = Date;

  function mockToday(isoDate: string) {
    const fixedNow = new realDate(isoDate);
    jest.spyOn(global, 'Date').mockImplementation(((...args: unknown[]) => {
      if (args.length === 0) return fixedNow;
      return new (realDate as any)(...args);
    }) as any);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resta 1 año adicional si el cumpleaños de este año todavía no ha ocurrido', () => {
    mockToday('2026-03-01T12:00:00Z');
    expect(calculateAge(new Date('2000-06-15'))).toBe(25);
  });

  it('cuenta el año en curso si el cumpleaños de este año ya ocurrió', () => {
    mockToday('2026-09-06T12:00:00Z');
    expect(calculateAge(new Date('2000-06-15'))).toBe(26);
  });

  it('cuenta el año en curso si hoy es exactamente el cumpleaños', () => {
    mockToday('2026-06-15T12:00:00Z');
    expect(calculateAge(new Date('2000-06-15'))).toBe(26);
  });

  it('maneja correctamente un cumpleaños del 29 de febrero (año bisiesto)', () => {
    mockToday('2025-03-01T12:00:00Z');
    expect(calculateAge(new Date('2000-02-29'))).toBe(25);
  });
});
