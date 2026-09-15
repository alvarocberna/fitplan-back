import { Controller, Get, UseGuards } from '@nestjs/common';
import { PanelService } from './panel.service';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CognitoUser } from '../auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';
import { PanelSummaryDto } from './dto/panel-summary.dto';

@Controller('panel')
export class PanelController {
  constructor(private readonly panelService: PanelService) {}

  @UseGuards(CognitoAuthGuard)
  @Get('resumen')
  getResumen(
    @CognitoUser() cognitoUser: CognitoUserClaims,
  ): Promise<PanelSummaryDto> {
    return this.panelService.getSummary(cognitoUser);
  }
}
