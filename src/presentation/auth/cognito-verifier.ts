import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

// Singleton perezoso, mismo patrón que getCognitoConfig() del frontend. tokenUse: 'access'
// sigue la recomendación de doc/security/deployment-security.md: autorizar llamadas a la API
// con el access_token, no el id_token.
export function getCognitoVerifier() {
  if (!verifier) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;
    if (!userPoolId || !clientId) {
      throw new Error(
        'Faltan las variables de entorno COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID',
      );
    }
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }
  return verifier;
}
