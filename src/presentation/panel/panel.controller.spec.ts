import { Test, TestingModule } from '@nestjs/testing';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';
import { PanelSummaryDto } from './dto/panel-summary.dto';

describe('PanelController', () => {
  let controller: PanelController;
  let service: jest.Mocked<PanelService>;

  const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PanelController],
      providers: [{ provide: PanelService, useValue: { getSummary: jest.fn() } }],
    }).compile();

    controller = module.get(PanelController);
    service = module.get(PanelService);
  });

  it('getResumen() delega en PanelService.getSummary con los claims de Cognito', async () => {
    const summary: PanelSummaryDto = {
      firstName: 'Ana',
      middleName: null,
      paternalLastName: 'Pérez',
      maternalLastName: null,
      age: 30,
      lastConsultationDate: null,
      goal: 'bajar de peso',
      nutritionalPlan: null,
    };
    service.getSummary.mockResolvedValue(summary);

    await expect(controller.getResumen(cognitoUser)).resolves.toBe(summary);
    expect(service.getSummary).toHaveBeenCalledWith(cognitoUser);
  });
});
