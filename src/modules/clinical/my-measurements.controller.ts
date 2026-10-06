import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import {
  ListMeasurementsQueryImpl,
  MeasurementDetailDto,
  MeasurementSummaryDto,
  RecordMeasurementDtoImpl,
  UpdateMeasurementDtoImpl,
} from './dto/measurement.dto';
import { ListMyMeasurementsUseCase } from './use-cases/list-my-measurements.use-case';
import { GetMyMeasurementUseCase } from './use-cases/get-my-measurement.use-case';
import { RecordMeasurementUseCase } from './use-cases/record-measurement.use-case';
import { UpdateMyMeasurementUseCase } from './use-cases/update-my-measurement.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('me/measurements')
export class MyMeasurementsController {
  constructor(
    private readonly listMyMeasurements: ListMyMeasurementsUseCase,
    private readonly getMyMeasurement: GetMyMeasurementUseCase,
    private readonly recordMeasurement: RecordMeasurementUseCase,
    private readonly updateMyMeasurement: UpdateMyMeasurementUseCase,
  ) {}

  @Get()
  list(
    @CognitoUser() claims: CognitoUserClaims,
    @Query() query: ListMeasurementsQueryImpl,
  ): Promise<MeasurementSummaryDto[]> {
    return this.listMyMeasurements.execute({
      claims,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get(':measurementId')
  getOne(
    @CognitoUser() claims: CognitoUserClaims,
    @Param('measurementId', new ParseUUIDPipe({ version: '4' })) measurementId: string,
  ): Promise<MeasurementDetailDto> {
    return this.getMyMeasurement.execute({ claims, measurementId });
  }

  @Post()
  record(
    @CognitoUser() claims: CognitoUserClaims,
    @Body() body: RecordMeasurementDtoImpl,
  ): Promise<MeasurementDetailDto> {
    return this.recordMeasurement.execute({ claims, data: body });
  }

  @Patch(':measurementId')
  update(
    @CognitoUser() claims: CognitoUserClaims,
    @Param('measurementId', new ParseUUIDPipe({ version: '4' })) measurementId: string,
    @Body() body: UpdateMeasurementDtoImpl,
  ): Promise<MeasurementDetailDto> {
    return this.updateMyMeasurement.execute({ claims, measurementId, data: body });
  }
}
