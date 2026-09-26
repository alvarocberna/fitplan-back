import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GenerationStatus,
  OrderStatusDto,
  OrderSummaryDto,
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
import {
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  ProductType,
} from '../../domain/entities/enums';
import type { OrderPaidExtras } from '../../domain/datasources/commercial-domain/order.datasource';
import { NutritionalConsultationEntity } from '../../domain/entities/clinical-record.entity';
import { StorageService } from '../storage/storage.service';
import {
  mapAnamnesisDtoToDetails,
  mapMeasurementsDtoToDetails,
} from './orders.mapper';

// Nombre con el que el navegador guarda el PDF al descargarlo desde el panel (solo dígitos y
// guiones en la parte variable, así que es seguro dentro del header Content-Disposition).
function buildPlanDownloadFilename(creationDate: Date): string {
  return `plan-nutricional-${creationDate.toISOString().slice(0, 10)}.pdf`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly authIdentityService: AuthIdentityService,
    private readonly clinicalRecordRepository: ClinicalRecordRepository,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly productRepository: ProductRepository,
    private readonly orderRepository: OrderRepository,
    private readonly storageService: StorageService,
  ) {}

  //crea la orden en paymentStatus=PENDING, antes de que el usuario pague
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
    // ordenes/crear ya no crea ni completa User (athlete también vive en el perfil).
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
      paymentStatus: PaymentStatus.PENDING,
      generationStatus: GenerationStatus.NOT_STARTED,
      planJson: null,
      pdfKey: null,
      thumbnailKey: null,
      attempts: 0,
      creationDate: new Date(),
      paymentDate: null,
      expirationDate: null,
    });

    const consultationDate = new Date();
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

  //crea la orden de un plan predefinido en paymentStatus=PENDING. A diferencia de createOrder no hay
  //consulta ni ficha clínica: la orden solo vincula al usuario (userId) con el producto que eligió, y el
  //monto sale siempre de product.price. Tampoco se exige perfil completo, basta con tener sesión.
  //la orden nace SIN pdfKey/thumbnailKey: se copian desde el producto recién al confirmarse el pago
  //(markAsPaid), porque getStatus entrega el PDF de cualquier orden que ya lo tenga.
  async createPredefinedOrder(
    code: string,
    cognitoUser: CognitoUserClaims,
  ): Promise<{ orderId: string }> {
    const user = await this.authIdentityService.getUserBySub(cognitoUser);

    const product =
      await this.productRepository.getActivePredefinedProductByCode(code);
    if (!product?.pdfKey) {
      throw new NotFoundException(`Plan ${code} no disponible`);
    }

    const order = await this.orderRepository.createOrder({
      userId: user.id,
      productId: product.id,
      amount: product.price,
      currency: product.currency,
      paymentStatus: PaymentStatus.PENDING,
      generationStatus: GenerationStatus.NOT_STARTED,
      planJson: null,
      pdfKey: null,
      thumbnailKey: null,
      attempts: 0,
      creationDate: new Date(),
      paymentDate: null,
      expirationDate: null,
    });

    return { orderId: order.id };
  }

  //estado público que consulta el frontend (sin la consulta nutricional completa, que es
  //información interna del pipeline de generación)
  //valida que la orden pertenezca al usuario del token (BOLA) — se devuelve NotFoundException
  //tanto si la orden no existe como si es de otro usuario, para no filtrar cuál de los dos casos es.
  async getStatus(
    id: string,
    cognitoUser: CognitoUserClaims,
  ): Promise<OrderStatusDto> {
    const user = await this.authIdentityService.getUserBySub(cognitoUser);
    const order = await this.findById(id);
    if (order.userId !== user.id) {
      throw new NotFoundException(`Orden ${id} no encontrada`);
    }

    const [pdfUrl, thumbnailUrl] = await Promise.all([
      order.pdfKey
        ? this.storageService.getSignedDownloadUrl(order.pdfKey, undefined, {
            downloadFilename: buildPlanDownloadFilename(order.creationDate),
          })
        : null,
      order.thumbnailKey
        ? this.storageService.getSignedDownloadUrl(order.thumbnailKey)
        : null,
    ]);

    return {
      paymentStatus: order.paymentStatus,
      generationStatus: order.generationStatus,
      planJson: order.planJson
        ? (JSON.parse(order.planJson) as NutritionPlanDto)
        : null,
      pdfUrl,
      thumbnailUrl,
    };
  }

  //listado de PDFs generados del usuario autenticado, más nuevo primero (panel del frontend).
  //siempre filtra por el usuario del token, no recibe ningún id externo, por lo que no hay BOLA
  //posible acá (a diferencia de getStatus).
  async getOrdersForUser(
    cognitoUser: CognitoUserClaims,
  ): Promise<OrderSummaryDto[]> {
    const user = await this.authIdentityService.getUserBySub(cognitoUser);
    const orders = await this.orderRepository.getPaidOrdersWithPdfByUserId(
      user.id,
    );

    return Promise.all(
      orders.map(async (order) => {
        const [pdfUrl, thumbnailUrl] = await Promise.all([
          this.storageService.getSignedDownloadUrl(
            order.pdfKey!,
            undefined,
            { downloadFilename: buildPlanDownloadFilename(order.creationDate) },
          ),
          order.thumbnailKey
            ? this.storageService.getSignedDownloadUrl(order.thumbnailKey)
            : null,
        ]);
        return {
          orderId: order.id,
          creationDate: order.creationDate,
          pdfUrl,
          thumbnailUrl,
        };
      }),
    );
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

  //idempotente: si ya estaba pagada, no vuelve a marcarla ni crea otro payment.
  //en UNA transacción marca order.paymentStatus=PAID y crea la fila payment (status AUTHORIZED),
  //para que ambas entidades queden consistentes. Devuelve markedNow=true si esta llamada fue la que
  //efectivamente marcó el pago, y el tipo del producto para que el webhook decida si hay que generar.
  //para un producto PREDEFINED, en el mismo instante copia su pdfKey/thumbnailKey a la orden y la deja
  //COMPLETED: recién ahora que está pagada la orden puede exponer el PDF (getStatus / GET /ordenes).
  async markAsPaid(
    id: string,
  ): Promise<{ markedNow: boolean; productType: ProductType }> {
    const order = await this.orderRepository.getOrderWithProductById(id);
    if (!order?.product) throw new NotFoundException(`Orden ${id} no encontrada`);
    const { product } = order;

    let extras: OrderPaidExtras | undefined;
    if (product.type === ProductType.PREDEFINED) {
      if (!product.pdfKey) {
        throw new Error(
          `Producto ${product.id} (PREDEFINED) sin pdfKey: no se puede entregar la orden ${id}`,
        );
      }
      extras = {
        pdfKey: product.pdfKey,
        thumbnailKey: product.thumbnailKey,
        generationStatus: GenerationStatus.COMPLETED,
      };
    }

    //el pago hoy es simulado: los campos de detalle son placeholders hasta integrar una pasarela real
    //(que los entregaría en su webhook).
    const markedNow = await this.orderRepository.markOrderAsPaidWithPayment(
      id,
      {
        provider: PaymentProvider.SIMULATED,
        paymentIdentifier: `SIM-${id}`,
        authorizationCode: 'SIMULATED',
        amount: order.amount,
        installmentCount: 1,
        status: PaymentTransactionStatus.AUTHORIZED,
        transactionDate: new Date(),
        movementType: 'SIMULATED',
        cardType: 'SIMULATED',
      },
      extras,
    );
    return { markedNow, productType: product.type };
  }

  //guard de estado: solo entra a GENERATING si no estaba ya en ese estado,
  //para evitar que dos disparos concurrentes (ej. reintento manual de webhook) generen el plan dos veces.
  async tryStartGeneration(id: string): Promise<boolean> {
    return this.orderRepository.tryTransitionOrderToGenerating(id);
  }

  async completeGeneration(
    id: string,
    plan: NutritionPlanDto,
    pdfKey: string,
    thumbnailKey: string | null,
  ): Promise<void> {
    await this.orderRepository.updateOrderById(id, {
      generationStatus: GenerationStatus.COMPLETED,
      planJson: JSON.stringify(plan),
      pdfKey,
      thumbnailKey,
    });
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.orderRepository.incrementOrderFailedAttempt(id);
  }
}
