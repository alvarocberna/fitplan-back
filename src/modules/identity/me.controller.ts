import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import {
  ProfileDto,
  SyncIdentityDtoImpl,
  UpdateProfileDtoImpl,
} from './dto/profile.dto';
import { SummaryDto } from './dto/summary.dto';
import { SyncIdentityUseCase } from './use-cases/sync-identity.use-case';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';
import { GetMySummaryUseCase } from './use-cases/get-my-summary.use-case';

// Recursos del usuario autenticado: el usuario sale siempre del token, nunca de un id externo.
// GET /me/plans vive en el módulo plans (my-plans.controller.ts).
@UseGuards(CognitoAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly syncIdentity: SyncIdentityUseCase,
    private readonly getMyProfile: GetMyProfileUseCase,
    private readonly updateMyProfile: UpdateMyProfileUseCase,
    private readonly getMySummary: GetMySummaryUseCase,
  ) {}

  // Idempotente: el frontend lo llama apenas hay sesión válida (callback de login).
  @Post('sync')
  sync(
    @Body() body: SyncIdentityDtoImpl,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<ProfileDto> {
    // body.email se acepta por compatibilidad pero no se usa: el email sale de Cognito
    void body;
    return this.syncIdentity.execute({ claims });
  }

  @Get()
  get(@CognitoUser() claims: CognitoUserClaims): Promise<ProfileDto> {
    return this.getMyProfile.execute({ claims });
  }

  @Patch()
  update(
    @Body() body: UpdateProfileDtoImpl,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<ProfileDto> {
    return this.updateMyProfile.execute({ claims, data: body });
  }

  @Get('summary')
  summary(@CognitoUser() claims: CognitoUserClaims): Promise<SummaryDto> {
    return this.getMySummary.execute({ claims });
  }
}
