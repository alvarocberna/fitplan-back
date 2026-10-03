import { BadRequestException, Injectable } from '@nestjs/common';
import { ClinicalRecordRepository } from '../../../domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { CreateOrderUseCase } from '../../billing/use-cases/create-order.use-case';
import { EvaluateGoalFeasibilityUseCase } from './evaluate-goal-feasibility.use-case';
import { CompleteConsultationDtoImpl } from '../dto/consultation.dto';
import {
  mapAnamnesisDtoToDetails,
  mapMeasurementsDtoToDetails,
} from '../consultation.mapper';

// CU-CON-02. Crea la consulta con su orden (paymentStatus=PENDING) ANTES de que el usuario pague: el
// webhook de pago es server a server y no tiene acceso al estado del navegador.
@Injectable()
export class CreateConsultationUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly clinicalRecordRepository: ClinicalRecordRepository,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly productRepository: ProductRepository,
    private readonly createOrder: CreateOrderUseCase,
    private readonly evaluateGoalFeasibility: EvaluateGoalFeasibilityUseCase,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    consultation: CompleteConsultationDtoImpl;
  }): Promise<{ orderId: string }> {
    const dto = input.consultation;
    if (!dto.personalInfo) {
      throw new BadRequestException('Falta personalInfo en la solicitud');
    }

    // El perfil (User) ya tiene que existir y estar completo a esta altura: se crea al primer login
    // (POST /me/sync) y se completa en informacion-personal (PATCH /me). Esta ruta no crea ni
    // completa el User (athlete también vive en el perfil).
    const user = await this.currentUser.resolve(input.claims);
    if (!this.currentUser.isProfileComplete(user)) {
      throw new BadRequestException(
        'Completa tu información personal antes de generar una orden',
      );
    }

    // Respaldo de CU-CON-03 (el frontend ya lo evalúa al terminar la evaluación física): no se
    // cobra ni se genera un plan de pérdida de peso para alguien cuyo peso ya es bajo.
    const feasibility = await this.evaluateGoalFeasibility.execute({
      claims: input.claims,
      goals: dto.anamnesis?.goals ?? null,
      measurements: dto.measurements,
    });
    if (!feasibility.feasible) {
      throw new BadRequestException(feasibility.message);
    }

    const clinicalRecord =
      await this.clinicalRecordRepository.findOrCreateClinicalRecordByPatientId(
        user.id,
      );
    const product =
      await this.productRepository.findOrCreateActiveGeneratedProduct();

    // Pendiente (CU-BIL-01): orden y consulta se escriben en dos operaciones separadas, no en una
    // misma transacción.
    const order = await this.createOrder.execute({ userId: user.id, product });

    const consultationDate = new Date();
    const consultationNumber =
      (await this.nutritionalConsultationRepository.getMaxConsultationNumberByClinicalRecordId(
        clinicalRecord.id,
      )) + 1;

    await this.nutritionalConsultationRepository.createNutritionalConsultationWithDetails(
      {
        consultation: {
          clinicalRecordId: clinicalRecord.id,
          patientId: user.id,
          orderId: order.id,
          consultationNumber,
          consultationDate,
          description: null,
        },
        anamnesis: mapAnamnesisDtoToDetails(dto.anamnesis),
        measurements: mapMeasurementsDtoToDetails(
          dto.measurements,
          consultationDate,
        ),
      },
    );

    return { orderId: order.id };
  }
}
