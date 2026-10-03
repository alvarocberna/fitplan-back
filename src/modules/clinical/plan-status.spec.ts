import { toPlanStatus } from './plan-status';

describe('toPlanStatus', () => {
  it.each([
    ['PENDING', 'NOT_STARTED', 'awaiting_payment'],
    ['REJECTED', 'NOT_STARTED', 'payment_rejected'],
    ['PAID', 'NOT_STARTED', 'generating'],
    ['PAID', 'GENERATING', 'generating'],
    ['PAID', 'COMPLETED', 'ready'],
    ['PAID', 'ERROR', 'error'],
  ] as const)(
    'paymentStatus %s + generationStatus %s -> %s',
    (paymentStatus, generationStatus, expected) => {
      expect(toPlanStatus({ paymentStatus, generationStatus })).toBe(expected);
    },
  );

  it('sin orden -> null', () => {
    expect(toPlanStatus(null)).toBeNull();
  });
});
