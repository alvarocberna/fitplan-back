import { subjectFromAuthorization } from './user-throttler.guard';

function jwtWith(payload: unknown): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.firma`;
}

describe('subjectFromAuthorization', () => {
  it('devuelve el sub del access token', () => {
    expect(subjectFromAuthorization(`Bearer ${jwtWith({ sub: 'sub-1' })}`)).toBe('sub-1');
  });

  it.each([
    [undefined],
    [''],
    ['Basic abc'],
    ['Bearer '],
    ['Bearer no-es-un-jwt'],
    ['Bearer a.%%%.c'],
    [`Bearer ${jwtWith({ otra: 'cosa' })}`],
    [`Bearer ${jwtWith({ sub: 123 })}`],
    [`Bearer ${jwtWith({ sub: 'x'.repeat(200) })}`],
    [['Bearer x']],
  ])('devuelve null para %p (se cuenta por IP)', (header) => {
    expect(subjectFromAuthorization(header)).toBeNull();
  });
});
