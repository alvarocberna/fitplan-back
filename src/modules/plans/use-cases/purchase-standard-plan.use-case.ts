import { Injectable, NotFoundException } from '@nestjs/common';
import { isPredefinedPlanCode } from '../../../domain';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { CreateOrderUseCase } from '../../billing/use-cases/create-order.use-case';

// CU-PLN-03. Crea la orden (paymentStatus=PENDING) de un plan estándar. A diferencia de la consulta no
// hay ficha clínica: la orden solo vincula al usuario con la versión elegida, y el monto sale siempre
// del producto (R3). Basta con tener sesión (no exige perfil completo). La orden nace SIN PDF: se copia
// desde el producto recién al confirmarse el pago (ConfirmPaymentUseCase).
@Injectable()
export class PurchaseStandardPlanUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly productRepository: ProductRepository,
    private readonly createOrder: CreateOrderUseCase,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    code: string;
  }): Promise<{ orderId: string }> {
    const { code } = input;
    const user = await this.currentUser.resolve(input.claims);

    // Mismo criterio que GetStandardPlanUseCase: código inválido, versión inexistente/inactiva o sin
    // PDF todavía (no se puede vender) -> 404.
    const product = isPredefinedPlanCode(code)
      ? await this.productRepository.getActivePredefinedProductByCode(code)
      : null;
    if (!product?.pdfKey) {
      throw new NotFoundException(`Plan ${code} no disponible`);
    }

    const order = await this.createOrder.execute({ userId: user.id, product });
    return { orderId: order.id };
  }
}
