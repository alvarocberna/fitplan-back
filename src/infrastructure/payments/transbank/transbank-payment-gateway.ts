import { Injectable } from '@nestjs/common';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from 'transbank-sdk';
import {
  CreatedGatewayTransaction,
  CreateGatewayTransactionInput,
  PaymentGateway,
  PaymentGatewayTransaction,
} from '../../../domain/ports';
import { PaymentGatewayUnavailableError } from '../../../domain/errors/payment.errors';

// Tope de cada llamada a Transbank: ocurren dentro de una request HTTP del usuario.
const REQUEST_TIMEOUT_MS = 15_000;
// Destino por defecto del retorno de Webpay fuera de producción (route handler del frontend).
const DEFAULT_RETURN_URL = 'http://localhost:3000/api/webpay/return';

// Respuesta de commit/status de Webpay Plus (solo los campos que se usan).
interface WebpayTransactionResponse {
  status?: string;
  response_code?: number;
  buy_order?: string;
  amount?: number;
  authorization_code?: string;
  payment_type_code?: string;
  installments_number?: number;
  transaction_date?: string;
  card_detail?: { card_number?: string };
}

type WebpayTransaction = InstanceType<typeof WebpayPlus.Transaction>;

// Adaptador de PaymentGateway sobre Webpay Plus (SDK oficial de Transbank). Con
// TRANSBANK_ENVIRONMENT=production exige las credenciales del comercio y la URL de retorno; en
// cualquier otro caso usa el ambiente de integración, con las credenciales públicas de prueba si no
// se configuran otras.
@Injectable()
export class TransbankPaymentGateway implements PaymentGateway {
  private readonly transaction: WebpayTransaction;
  private readonly returnUrl: string;

  constructor() {
    const isProduction = process.env.TRANSBANK_ENVIRONMENT === 'production';
    const commerceCode = process.env.TRANSBANK_COMMERCE_CODE;
    const apiKey = process.env.TRANSBANK_API_KEY;
    const returnUrl = process.env.WEBPAY_RETURN_URL;

    if (isProduction && (!commerceCode || !apiKey || !returnUrl)) {
      throw new Error(
        'TRANSBANK_ENVIRONMENT=production exige TRANSBANK_COMMERCE_CODE, TRANSBANK_API_KEY y WEBPAY_RETURN_URL',
      );
    }

    this.returnUrl = returnUrl || DEFAULT_RETURN_URL;
    this.transaction = new WebpayPlus.Transaction(
      new Options(
        commerceCode || IntegrationCommerceCodes.WEBPAY_PLUS,
        apiKey || IntegrationApiKeys.WEBPAY,
        isProduction ? Environment.Production : Environment.Integration,
        REQUEST_TIMEOUT_MS,
      ),
    );
  }

  async createTransaction(
    input: CreateGatewayTransactionInput,
  ): Promise<CreatedGatewayTransaction> {
    const response = (await this.call('create', () =>
      this.transaction.create(
        input.buyOrder,
        input.sessionId,
        input.amount,
        this.returnUrl,
      ),
    )) as { token?: string; url?: string };
    if (!response?.token || !response?.url) {
      throw new PaymentGatewayUnavailableError(
        'Transbank create: respuesta sin token o url',
      );
    }
    return { token: response.token, redirectUrl: response.url };
  }

  async commitTransaction(token: string): Promise<PaymentGatewayTransaction> {
    const response = await this.call('commit', () =>
      this.transaction.commit(token),
    );
    return this.toTransaction(response as WebpayTransactionResponse);
  }

  async getTransactionStatus(
    token: string,
  ): Promise<PaymentGatewayTransaction> {
    const response = await this.call('status', () =>
      this.transaction.status(token),
    );
    return this.toTransaction(response as WebpayTransactionResponse);
  }

  // El SDK lanza TransbankError tanto si no hubo respuesta como si Transbank respondió con error.
  private async call(
    operation: string,
    run: () => Promise<unknown>,
  ): Promise<unknown> {
    try {
      return await run();
    } catch (error) {
      throw new PaymentGatewayUnavailableError(
        `Transbank ${operation}: ${error instanceof Error ? error.message.trim() : String(error)}`,
        error,
      );
    }
  }

  private toTransaction(
    response: WebpayTransactionResponse,
  ): PaymentGatewayTransaction {
    const status = response?.status ?? '';
    const responseCode =
      typeof response?.response_code === 'number'
        ? response.response_code
        : null;
    return {
      approved: status === 'AUTHORIZED' && responseCode === 0,
      status,
      responseCode,
      buyOrder: response?.buy_order ?? '',
      amount: Number(response?.amount ?? 0),
      authorizationCode: response?.authorization_code ?? null,
      paymentTypeCode: response?.payment_type_code ?? null,
      installmentCount: response?.installments_number ?? 0,
      cardLastDigits: response?.card_detail?.card_number ?? null,
      transactionDate: response?.transaction_date
        ? new Date(response.transaction_date)
        : null,
    };
  }
}
