import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { ConsultationSummaryDto } from './dto/consultation-summary.dto';
import { ConsultationDetailDto } from './dto/consultation-detail.dto';
import { ListMyConsultationsUseCase } from './use-cases/list-my-consultations.use-case';
import { GetMyConsultationUseCase } from './use-cases/get-my-consultation.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('me/consultations')
export class MyConsultationsController {
  constructor(
    private readonly listMyConsultations: ListMyConsultationsUseCase,
    private readonly getMyConsultation: GetMyConsultationUseCase,
  ) {}

  @Get()
  list(
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<ConsultationSummaryDto[]> {
    return this.listMyConsultations.execute({ claims });
  }

  @Get(':consultationId')
  getOne(
    @CognitoUser() claims: CognitoUserClaims,
    @Param('consultationId', new ParseUUIDPipe({ version: '4' }))
    consultationId: string,
  ): Promise<ConsultationDetailDto> {
    return this.getMyConsultation.execute({ claims, consultationId });
  }
}
