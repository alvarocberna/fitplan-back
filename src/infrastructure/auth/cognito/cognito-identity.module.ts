import { Module } from '@nestjs/common';
import { IdentityProvider } from '../../../domain/ports';
import { CognitoIdentityProvider } from './cognito-identity-provider';

@Module({
  providers: [{ provide: IdentityProvider, useClass: CognitoIdentityProvider }],
  exports: [IdentityProvider],
})
export class CognitoIdentityModule {}
