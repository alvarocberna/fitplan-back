import { parsePlanJson } from './plan-json';

describe('parsePlanJson', () => {
  it('devuelve el plan parseado', () => {
    expect(parsePlanJson('{"prescription":{"goal":"volumen"}}')).toEqual({
      prescription: { goal: 'volumen' },
    });
  });

  it.each([[null], [undefined], [''], ['{ no es json'], ['"un string"'], ['null']])(
    'devuelve null para %p',
    (raw) => {
      expect(parsePlanJson(raw)).toBeNull();
    },
  );
});
