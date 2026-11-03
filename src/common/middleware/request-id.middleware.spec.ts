import {
  requestIdMiddleware,
  REQUEST_ID_HEADER,
} from './request-id.middleware';

function run(headers: Record<string, string | string[]> = {}) {
  const req = { headers } as any;
  const res = { setHeader: jest.fn() } as any;
  const next = jest.fn();
  requestIdMiddleware(req, res, next);
  return { req, res, next };
}

describe('requestIdMiddleware', () => {
  it('genera un id, lo deja en la request y lo devuelve en el header', () => {
    const { req, res, next } = run();

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      req.requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reutiliza el x-request-id que manda el llamador', () => {
    const { req } = run({ [REQUEST_ID_HEADER]: 'front-request-0001' });

    expect(req.requestId).toBe('front-request-0001');
  });

  it.each([['corto'], ['con espacios y\nsaltos de línea'], ['x'.repeat(200)]])(
    'descarta un id con forma inválida (%s) y genera uno propio',
    (incoming) => {
      const { req } = run({ [REQUEST_ID_HEADER]: incoming });

      expect(req.requestId).not.toBe(incoming);
      expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});
