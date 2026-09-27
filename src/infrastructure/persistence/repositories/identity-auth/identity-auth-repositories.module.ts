import { Module } from '@nestjs/common';
import { IdentityAuthDatasourcesModule } from '../../datasources/identity-auth/identity-auth-datasources.module';
import { UserRepository } from '../../../../domain/repositories/identity-auth/user.repository';
import { UserRepositoryImpl } from './user.repository';
import { AuthIdentityRepository } from '../../../../domain/repositories/identity-auth/auth-identity.repository';
import { AuthIdentityRepositoryImpl } from './auth-identity.repository';

// Ata cada clase abstracta de domain/repositories/identity-auth a su implementación concreta, que
// a su vez delega en el datasource correspondiente (ver IdentityAuthDatasourcesModule). Los módulos
// consumidores inyectan el token abstracto (ej. UserRepository), nunca el *Impl.
@Module({
  imports: [IdentityAuthDatasourcesModule],
  providers: [
    { provide: UserRepository, useClass: UserRepositoryImpl },
    { provide: AuthIdentityRepository, useClass: AuthIdentityRepositoryImpl },
  ],
  exports: [UserRepository, AuthIdentityRepository],
})
export class IdentityAuthRepositoriesModule {}
