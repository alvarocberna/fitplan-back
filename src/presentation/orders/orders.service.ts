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
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
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
    private readonly userRepository: UserRepository,
    private readonly clinicalRecordRepository: ClinicalRecordRepository,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly productRepository: ProductRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  //crea la orden en paymentStatus='pendiente', antes de que el usuario pague
  //(el webhook de pago es server-a-server y no tiene acceso al localStorage del navegador)
  async createOrder(
    dto: CompleteConsultationDtoImpl,
  ): Promise<{ orderId: string }> {
    const personalInfo = dto.personalInfo;
    if (!personalInfo?.email) {
      throw new BadRequestException(
        'Falta el correo de contacto para la orden',
      );
    }
    // firstName/paternalLastName/gender/dateOfBirth vienen garantizados no-null por los
    // @IsNotEmpty() de PersonalInfoDtoImpl (ver presentation/consultation/dto/consultation.dto.ts).
    // dateOfBirth llega como string ISO ('1990-05-15'): @IsDateString() solo valida el formato,
    // no lo convierte a Date (no hay @Type(() => Date) en el DTO) — hay que convertirlo acá antes
    // de pasarlo a Prisma, que rechaza un string incompleto para una columna DateTime.

    const user = await this.userRepository.findOrCreateUserByEmail({
      email: personalInfo.email,
      rut: personalInfo.rut !== null ? String(personalInfo.rut) : null,
      rutCheckDigit: personalInfo.dvRut,
      firstName: personalInfo.firstName!,
      middleName: personalInfo.middleName,
      paternalLastName: personalInfo.paternalLastName!,
      maternalLastName: personalInfo.maternalLastName,
      gender: personalInfo.gender!,
      dateOfBirth: new Date(personalInfo.dateOfBirth!),
    });

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
