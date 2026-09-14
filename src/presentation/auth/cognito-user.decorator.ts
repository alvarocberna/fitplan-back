import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// El access_token de Cognito no trae email/nombre (ver cognito-auth.guard.ts) — solo el sub,
// identificador estable e inmutable de la identidad.
export interface CognitoUserClaims {
  sub: string;
}

export const CognitoUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CognitoUserClaims => {
    return ctx.switchToHttp().getRequest().cognitoUser;
  },
);
