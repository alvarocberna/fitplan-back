// Puerto hacia la pasarela de pago (hoy Webpay Plus de Transbank, ver infrastructure/payments/transbank).
// El flujo es: crear la transacción -> el usuario paga en el formulario de la pasarela -> al volver se
// confirma (commit). Una transacción que nunca se confirma no se cobra.

export interface CreateGatewayTransactionInput {
  // Identificador del intento de pago en el comercio: único y de a lo más 26 caracteres.
  buyOrder: string;
  sessionId: string;
  // Monto en pesos, entero.
  amount: number;
}

export interface CreatedGatewayTransaction {
  token: string;
  // URL del formulario de pago, a la que el navegador debe enviar el token.
  redirectUrl: string;
}

export interface PaymentGatewayTransaction {
  // true solo si la pasarela autorizó el cobro.
  approved: boolean;
  // Estado tal como lo informa la pasarela (INITIALIZED, AUTHORIZED, FAILED, ...).
  status: string;
  responseCode: number | null;
  buyOrder: string;
  amount: number;
  authorizationCode: string | null;
  // Tipo de pago según la pasarela (VD débito, VN crédito sin cuotas, VP prepago, ...).
  paymentTypeCode: string | null;
  installmentCount: number;
  cardLastDigits: string | null;
  transactionDate: Date | null;
}

export abstract class PaymentGateway {
  // Lanza PaymentGatewayUnavailableError si la pasarela no responde o rechaza la llamada.
  abstract createTransaction(
    input: CreateGatewayTransactionInput,
  ): Promise<CreatedGatewayTransaction>;

  // Confirma el cobro de una transacción que el usuario ya pagó. Solo se puede confirmar una vez.
  abstract commitTransaction(token: string): Promise<PaymentGatewayTransaction>;

  abstract getTransactionStatus(
    token: string,
  ): Promise<PaymentGatewayTransaction>;
}
