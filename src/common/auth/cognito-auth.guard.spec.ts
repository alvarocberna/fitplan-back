import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { FetchError, JwtExpiredError } from 'aws-jwt-verify/error';
import { ErrorCode } from '../errors/error-codes';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { getCognitoVerifier } from '../../infrastructure/auth/cognito/cognito-verifier';

jest.mock('../../infrastructure/auth/cognito/cognito-verifier', () => ({
  getCognitoVerifier: jest.fn(),
}));

function createContext(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; cognitoUser?: { sub: string } } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('CognitoAuthGuard', () => {
  let guard: CognitoAuthGuard;
  let verify: jest.Mock;
  const AUTH = { authorization: 'Bearer token-1' };

  beforeEach(() => {
    verify = jest.fn();
    (getCognitoVerifier as jest.Mock).mockReset().mockReturnValue({ verify });
    guard = new CognitoAuthGuard();
    jest.spyOn((guard as any).logger, 'error').mockImplementation(() => undefined);
  });

  it('con un token válido deja pasar y deja el sub en la request', async () => {
    verify.mockResolvedValue({ sub: 'sub-1' });
    const { context, request } = createContext(AUTH);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('token-1');
    expect(request.cognitoUser).toEqual({ sub: 'sub-1' });
  });

  it.each([[{}], [{ authorization: 'Basic abc' }]])(
    'sin un Bearer token responde 401 sin llamar al verificador',
    async (headers) => {
      const { context } = createContext(headers as Record<string, string>);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(getCognitoVerifier).not.toHaveBeenCalled();
    },
  );

  it('un token que no pasa la verificación (expirado) responde 401', async () => {
    verify.mockRejectedValue(new JwtExpiredError('Token expired', undefined));
    const { context } = createContext(AUTH);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect((guard as any).logger.error).not.toHaveBeenCalled();
  });

  it('no poder obtener las claves de Cognito responde 503 AUTH_UNAVAILABLE y queda en el log', async () => {
    verify.mockRejectedValue(new FetchError('https://cognito/jwks.json', 'ECONNREFUSED'));
    const { context } = createContext(AUTH);

    const error: ServiceUnavailableException = await guard.canActivate(context).then(
      () => { throw new Error('se esperaba un rechazo'); },
      (e: ServiceUnavailableException) => e,
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).toMatchObject({ code: ErrorCode.AUTH_UNAVAILABLE });
    expect((guard as any).logger.error).toHaveBeenCalled();
  });

  it('un fallo inesperado del verificador tampoco se disfraza de 401', async () => {
    verify.mockRejectedValue(new Error('boom'));
    const { context } = createContext(AUTH);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('una configuración de Cognito faltante se propaga como error del servidor, no como 401', async () => {
    (getCognitoVerifier as jest.Mock).mockImplementation(() => {
      throw new Error('Faltan las variables de entorno COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID');
    });
    const { context } = createContext(AUTH);

    await expect(guard.canActivate(context)).rejects.toThrow('Faltan las variables de entorno');
  });
});
