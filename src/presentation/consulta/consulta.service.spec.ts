import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiService } from '../openai/openai.service';
import { ConsultaService } from './consulta.service';

describe('ConsultaService', () => {
  let service: ConsultaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConsultaService, OpenaiService],
    }).compile();

    service = module.get<ConsultaService>(ConsultaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
