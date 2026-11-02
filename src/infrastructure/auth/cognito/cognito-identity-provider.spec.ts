import { CognitoIdentityProvider } from './cognito-identity-provider';
import { IdentityProviderUnavailableError } from '../../../domain/errors/identity.errors';

const DISCOVERY_URL =
  'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123/.well-known/openid-configuration';
const USERINFO_URL = 'https://auth.example.com/oauth2/userInfo';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('CognitoIdentityProvider', () => {
  let provider: CognitoIdentityProvider;
  let fetchMock: jest.Mock;
  const previousPool = process.env.COGNITO_USER_POOL_ID;

  // primera llamada = discovery, segunda = userInfo
  const mockUserInfo = (userInfo: unknown, status = 200) =>
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { userinfo_endpoint: USERINFO_URL }),
      )
      .mockResolvedValueOnce(jsonResponse(status, userInfo));

  beforeEach(() => {
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_abc123';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    provider = new CognitoIdentityProvider();
  });

  afterAll(() => {
    process.env.COGNITO_USER_POOL_ID = previousPool;
  });

  it('pregunta a userInfo con el access token (endpoint tomado del discovery del User Pool)', async () => {
    mockUserInfo({
      sub: 'sub-1',
      email: 'Ana@Example.com',
      email_verified: 'true',
    });

    const identity = await provider.getIdentity('access-token-1');

    expect(fetchMock.mock.calls[0][0]).toBe(DISCOVERY_URL);
    expect(fetchMock.mock.calls[1][0]).toBe(USERINFO_URL);
    expect(fetchMock.mock.calls[1][1].headers).toEqual({
      Authorization: 'Bearer access-token-1',
    });
    expect(identity).toEqual({
      sub: 'sub-1',
      email: 'ana@example.com',
      emailVerified: true,
    });
  });

  it.each([
    [{ email_verified: true }, true],
    [{ email_verified: 'true' }, true],
    [{ email_verified: 'false' }, false],
    [{ email_verified: false }, false],
    [{}, false],
    // cuenta federada de Google: Google solo entrega correos ya verificados
    [{ email_verified: 'false', username: 'google_1234567890' }, true],
    [{ username: 'Google_1234567890' }, true],
    [{ username: 'ana' }, false],
  ])('emailVerified para %p es %p', async (attributes, expected) => {
    mockUserInfo({ sub: 'sub-1', email: 'ana@example.com', ...attributes });

    await expect(provider.getIdentity('t')).resolves.toMatchObject({
      emailVerified: expected,
    });
  });

  it('cachea el discovery entre llamadas', async () => {
    mockUserInfo({
      sub: 'sub-1',
      email: 'ana@example.com',
      email_verified: true,
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        sub: 'sub-1',
        email: 'ana@example.com',
        email_verified: true,
      }),
    );

    await provider.getIdentity('t');
    await provider.getIdentity('t');

    expect(
      fetchMock.mock.calls.filter(([url]) => url === DISCOVERY_URL),
    ).toHaveLength(1);
  });

  it.each([
    [
      'Cognito rechaza el token',
      () => mockUserInfo({ error: 'invalid_token' }, 401),
    ],
    [
      'userInfo responde sin sub',
      () => mockUserInfo({ email: 'ana@example.com' }),
    ],
    [
      'no hay red',
      () => fetchMock.mockRejectedValue(new TypeError('fetch failed')),
    ],
    [
      'el discovery no trae userinfo_endpoint',
      () => fetchMock.mockResolvedValue(jsonResponse(200, {})),
    ],
  ])('lanza IdentityProviderUnavailableError si %s', async (_name, arrange) => {
    arrange();

    await expect(provider.getIdentity('t')).rejects.toBeInstanceOf(
      IdentityProviderUnavailableError,
    );
  });

  it('tras un discovery fallido reintenta en la siguiente llamada', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(provider.getIdentity('t')).rejects.toBeInstanceOf(
      IdentityProviderUnavailableError,
    );

    mockUserInfo({
      sub: 'sub-1',
      email: 'ana@example.com',
      email_verified: true,
    });
    await expect(provider.getIdentity('t')).resolves.toMatchObject({
      sub: 'sub-1',
    });
  });
});
