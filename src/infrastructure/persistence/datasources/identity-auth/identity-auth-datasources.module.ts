import { Module } from '@nestjs/common';
import { UserDatasource } from '../../../../domain/datasources/identity-auth/user.datasource';
import { UserDatasourceImpl } from './user.datasource';
import { AuthIdentityDatasource } from '../../../../domain/datasources/identity-auth/auth-identity.datasource';
import { AuthIdentityDatasourceImpl } from './auth-identity.datasource';

// Ata cada clase abstracta de domain/datasources/identity-auth a su implementación concreta
// (Prisma). Los módulos consumidores inyectan el token abstracto (ej. UserDatasource), nunca
// el *Impl, para no acoplarse a Prisma.
@Module({
  providers: [
    { provide: UserDatasource, useClass: UserDatasourceImpl },
    { provide: AuthIdentityDatasource, useClass: AuthIdentityDatasourceImpl },
  ],
  exports: [UserDatasource, AuthIdentityDatasource],
})
export class IdentityAuthDatasourcesModule {}
