import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthIdentityService } from './auth-identity.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { CognitoUser } from './cognito-user.decorator';
import type { CognitoUserClaims } from './cognito-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import {
  ActualizarPerfilDtoImpl,
  PerfilResponseDto,
  SincronizarPerfilDtoImpl,
} from './dto/perfil.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authIdentityService: AuthIdentityService) {}

  // Idempotente: crea AuthIdentity + un User "esqueleto" la primera vez que se ve este sub de
  // Cognito (email tomado de la sesión, no de un formulario). El frontend lo llama apenas hay
  // sesión válida (consulta/inicio, informacion-personal) para saber si el perfil ya está completo.
  @UseGuards(CognitoAuthGuard)
  @Post('perfil')
  async sync(
    @Body() body: SincronizarPerfilDtoImpl,
    @CognitoUser() cognitoUser: CognitoUserClaims,
  ): Promise<PerfilResponseDto> {
    const user = await this.authIdentityService.syncUser(cognitoUser, body.email);
    return this.toResponse(user);
  }

  @UseGuards(CognitoAuthGuard)
  @Patch('perfil')
  async update(
    @Body() body: ActualizarPerfilDtoImpl,
    @CognitoUser() cognitoUser: CognitoUserClaims,
  ): Promise<PerfilResponseDto> {
    const user = await this.authIdentityService.updateProfile(cognitoUser, {
      rut: body.rut ?? null,
      rutCheckDigit: body.rutCheckDigit ?? null,
      firstName: body.firstName,
      middleName: body.middleName ?? null,
      paternalLastName: body.paternalLastName,
      maternalLastName: body.maternalLastName ?? null,
      gender: body.gender,
      dateOfBirth: new Date(body.dateOfBirth),
      athlete: body.athlete,
    });
    return this.toResponse(user);
  }

  private toResponse(user: UserEntity): PerfilResponseDto {
    return {
      firstName: user.firstName,
      middleName: user.middleName,
      paternalLastName: user.paternalLastName,
      maternalLastName: user.maternalLastName,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      athlete: user.athlete,
      email: user.email,
      rut: user.rut,
      rutCheckDigit: user.rutCheckDigit,
      profileComplete: this.authIdentityService.isProfileComplete(user),
    };
  }
}
