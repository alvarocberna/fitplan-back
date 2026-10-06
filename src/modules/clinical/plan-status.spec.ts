import { toPlanStatus } from './plan-status';

describe('toPlanStatus', () => {
  it.each([
    ['PENDING', 'NOT_STARTED', 0, 'awaiting_payment'],
    ['REJECTED', 'NOT_STARTED', 0, 'payment_rejected'],
    ['PAID', 'NOT_STARTED', 0, 'generating'],
    ['PAID', 'GENERATING', 0, 'generating'],
    ['PAID', 'COMPLETED', 0, 'ready'],
    // un fallo con reintentos automáticos pendientes sigue "generándose"
    ['PAID', 'ERROR', 1, 'generating'],
    ['PAID', 'ERROR', 3, 'generating'],
    // agotadas las 4 rondas el error es definitivo
    ['PAID', 'ERROR', 4, 'error'],
  ] as const)(
    'paymentStatus %s + generationStatus %s + attempts %i -> %s',
    (paymentStatus, generationStatus, attempts, expected) => {
      expect(toPlanStatus({ paymentStatus, generationStatus, attempts })).toBe(expected);
    },
  );

  it('sin orden -> null', () => {
    expect(toPlanStatus(null)).toBeNull();
  });
});
