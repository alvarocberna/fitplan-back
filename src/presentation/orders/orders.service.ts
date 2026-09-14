import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GenerationStatus,
  OrderStatusDto,
  NutritionPlanDto,
} from '../../domain';
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';
import { AuthIdentityService } from '../auth/auth-identity.service';
import { CognitoUserClaims } from '../auth/cognito-user.decorator';
import { ClinicalRecordRepository } from '../../domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { ProductRepository } from '../../domain/repositories/commercial-domain/product.repository';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import { OrderEntity } from '../../domain/entities/order.entity';
import { NutritionalConsultationEntity } from '../../domain/entities/clinical-record.entity';
import {
  mapAnamnesisDtoToDetails,
  mapMeasurementsDtoToDetails,
} from './orders.mapper';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly authIdentityService: AuthIdentityService,
    private readonly clinicalRecordRepository: ClinicalRecordRepository,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly productRepository: ProductRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  //crea la orden en paymentStatus='pendiente', antes de que el usuario pague
  //(el webhook de pago es server-a-server y no tiene acceso al localStorage del navegador)
  async createOrder(
    dto: CompleteConsultationDtoImpl,
    cognitoUser: CognitoUserClaims,
  ): Promise<{ orderId: string }> {
    const personalInfo = dto.personalInfo;
    if (!personalInfo) {
      throw new BadRequestException('Falta personalInfo en la solicitud');
    }

    // El perfil (User) ya tiene que existir y estar completo a esta altura — se crea al primer
    // login (POST /auth/perfil) y se completa en informacion-personal (PATCH /auth/perfil).
    // ordenes/crear ya no crea ni completa User, solo lee el athlete puntual de esta consulta.
    const user = await this.authIdentityService.getUserBySub(cognitoUser);
    if (!this.authIdentityService.isProfileComplete(user)) {
      throw new BadRequestException(
        'Completa tu información personal antes de generar una orden',
      );
    }

    const clinicalRecord =
      await this.clinicalRecordRepository.findOrCreateClinicalRecordByPatientId(
        user.id,
      );
    const product =
      await this.productRepository.findOrCreateActiveGeneratedProduct();

    const order = await this.orderRepository.createOrder({
      userId: user.id,
      productId: product.id,
      amount: product.price,
      currency: product.currency,
      paymentStatus: 'pendiente',
      generationStatus: 'no_iniciado',
      planJson: null,
      attempts: 0,
      creationDate: new Date(),
      paymentDate: null,
      expirationDate: null,
    });

    const consultationNumber =
      (await this.nutritionalConsultationRepository.countNutritionalConsultationsByClinicalRecordId(
        clinicalRecord.id,
      )) + 1;

    await this.nutritionalConsultationRepository.createNutritionalConsultationWithDetails(
      {
        consultation: {
          clinicalRecordId: clinicalRecord.id,
          patientId: user.id,
          orderId: order.id,
          consultationNumber,
          consultationDate: new Date(),
          description: null,
          athlete: personalInfo.athlete ?? null,
        },
        anamnesis: mapAnamnesisDtoToDetails(dto.anamnesis),
        measurements: mapMeasurementsDtoToDetails(dto.measurements),
      },
    );

    return { orderId: order.id };
  }

  //estado público que consulta el frontend (sin la consulta nutricional completa, que es
  //información interna del pipeline de generación)
  async getStatus(id: string): Promise<OrderStatusDto> {
    const order = await this.findById(id);
    return {
      paymentStatus: order.paymentStatus,
      generationStatus: order.generationStatus as GenerationStatus,
      planJson: order.planJson
        ? (JSON.parse(order.planJson) as NutritionPlanDto)
        : null,
    };
  }

  async findById(id: string): Promise<OrderEntity> {
    const order = await this.orderRepository.getOrderById(id);
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    return order;
  }

  //usado por plan-generation para obtener el email del usuario (order.user.email)
  async findByIdWithUser(id: string): Promise<OrderEntity> {
    const order = await this.orderRepository.getOrderWithUserById(id);
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    return order;
  }

  //fuente de verdad para la generación del plan: reemplaza al antiguo getPayload()/payloadJson
  async getConsultationForOrder(
    id: string,
  ): Promise<NutritionalConsultationEntity> {
    const consultation =
      await this.nutritionalConsultationRepository.getNutritionalConsultationWithDetailsByOrderId(
        id,
      );
    if (!consultation)
      throw new NotFoundException(`No hay consulta asociada a la orden ${id}`);
    return consultation;
  }

  //idempotente: si ya estaba pagada, no vuelve a marcarla ni dispara nada.
  //devuelve true si esta llamada fue la que efectivamente marcó el pago.
  async markAsPaid(id: string): Promise<boolean> {
    return this.orderRepository.markOrderAsPaidIfPending(id);
  }

  //guard de estado: solo entra a 'generando' si no estaba ya en ese estado,
  //para evitar que dos disparos concurrentes (ej. reintento manual de webhook) generen el plan dos veces.
  async tryStartGeneration(id: string): Promise<boolean> {
    return this.orderRepository.tryTransitionOrderToGenerating(id);
  }

  async completeGeneration(id: string, plan: NutritionPlanDto): Promise<void> {
    await this.orderRepository.updateOrderById(id, {
      generationStatus: 'completado',
      planJson: JSON.stringify(plan),
    });
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.orderRepository.incrementOrderFailedAttempt(id);
  }

  //job de retención: anula el contenido sensible de órdenes antiguas, conservando el resto de la fila
  async cleanupOldOrders(retentionDays: number): Promise<number> {
    const limit = new Date();
    limit.setDate(limit.getDate() - retentionDays);

    const count = await this.orderRepository.anonymizeOldOrders(limit);
    if (count > 0)
      this.logger.log(`Limpieza de retención: ${count} orden(es) anonimizadas`);
    return count;
  }
}
