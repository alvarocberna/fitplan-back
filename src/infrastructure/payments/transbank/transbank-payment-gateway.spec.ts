import { PaymentGatewayUnavailableError } from '../../../domain/errors/payment.errors';

const transaction = { create: jest.fn(), commit: jest.fn(), status: jest.fn() };
const TransactionMock = jest.fn(() => transaction);
const OptionsMock = jest.fn(
  (
    commerceCode: string,
    apiKey: string,
    environment: string,
    timeout?: number,
  ) => ({
    commerceCode,
    apiKey,
    environment,
    timeout,
  }),
);

jest.mock('transbank-sdk', () => ({
  WebpayPlus: { Transaction: TransactionMock },
  Options: OptionsMock,
  Environment: {
    Integration: 'https://integration.test',
    Production: 'https://production.test',
  },
  IntegrationCommerceCodes: { WEBPAY_PLUS: 'integration-commerce' },
  IntegrationApiKeys: { WEBPAY: 'integration-key' },
}));

import { TransbankPaymentGateway } from './transbank-payment-gateway';

describe('TransbankPaymentGateway', () => {
  const ENV_KEYS = [
    'TRANSBANK_ENVIRONMENT',
    'TRANSBANK_COMMERCE_CODE',
    'TRANSBANK_API_KEY',
    'WEBPAY_RETURN_URL',
  ];
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ENV_KEYS.forEach((key) => delete process.env[key]);
  });

  afterAll(() => {
    ENV_KEYS.forEach((key) => {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    });
  });

  describe('configuración', () => {
    it('sin configuración usa el ambiente de integración con las credenciales públicas de prueba', () => {
      new TransbankPaymentGateway();

      expect(OptionsMock).toHaveBeenCalledWith(
        'integration-commerce',
        'integration-key',
        'https://integration.test',
        expect.any(Number),
      );
    });

    it('en producción usa las credenciales del comercio', () => {
      process.env.TRANSBANK_ENVIRONMENT = 'production';
      process.env.TRANSBANK_COMMERCE_CODE = '597012345678';
      process.env.TRANSBANK_API_KEY = 'secreta';
      process.env.WEBPAY_RETURN_URL = 'https://app.test/api/webpay/return';

      new TransbankPaymentGateway();

      expect(OptionsMock).toHaveBeenCalledWith(
        '597012345678',
        'secreta',
        'https://production.test',
        expect.any(Number),
      );
    });

    it.each([
      'TRANSBANK_COMMERCE_CODE',
      'TRANSBANK_API_KEY',
      'WEBPAY_RETURN_URL',
    ])('en producción falla al construirse si falta %s', (missing) => {
      process.env.TRANSBANK_ENVIRONMENT = 'production';
      process.env.TRANSBANK_COMMERCE_CODE = '597012345678';
      process.env.TRANSBANK_API_KEY = 'secreta';
      process.env.WEBPAY_RETURN_URL = 'https://app.test/api/webpay/return';
      delete process.env[missing];

      expect(() => new TransbankPaymentGateway()).toThrow(
        /TRANSBANK_ENVIRONMENT=production/,
      );
    });
  });

  describe('createTransaction', () => {
    it('crea la transacción con la URL de retorno configurada y devuelve token y URL del formulario', async () => {
      process.env.WEBPAY_RETURN_URL = 'https://app.test/api/webpay/return';
      transaction.create.mockResolvedValue({
        token: 'tok-1',
        url: 'https://webpay.test/init',
      });

      const result = await new TransbankPaymentGateway().createTransaction({
        buyOrder: 'buy-order-1',
        sessionId: 'user-1',
        amount: 19990,
      });

      expect(result).toEqual({
        token: 'tok-1',
        redirectUrl: 'https://webpay.test/init',
      });
      expect(transaction.create).toHaveBeenCalledWith(
        'buy-order-1',
        'user-1',
        19990,
        'https://app.test/api/webpay/return',
      );
    });

    it('traduce el error del SDK a PaymentGatewayUnavailableError', async () => {
      transaction.create.mockRejectedValue(
        new Error('AxiosError: timeout\nUnexpected error\n'),
      );

      await expect(
        new TransbankPaymentGateway().createTransaction({
          buyOrder: 'buy-order-1',
          sessionId: 'user-1',
          amount: 19990,
        }),
      ).rejects.toBeInstanceOf(PaymentGatewayUnavailableError);
    });

    it('una respuesta sin token también es un fallo de la pasarela', async () => {
      transaction.create.mockResolvedValue({});

      await expect(
        new TransbankPaymentGateway().createTransaction({
          buyOrder: 'buy-order-1',
          sessionId: 'user-1',
          amount: 19990,
        }),
      ).rejects.toBeInstanceOf(PaymentGatewayUnavailableError);
    });
  });

  describe('commitTransaction / getTransactionStatus', () => {
    const webpayResponse = {
      vci: 'TSY',
      amount: 19990,
      status: 'AUTHORIZED',
      buy_order: 'buy-order-1',
      session_id: 'user-1',
      card_detail: { card_number: '6623' },
      accounting_date: '1007',
      transaction_date: '2026-10-07T12:00:00.000Z',
      authorization_code: '1213',
      payment_type_code: 'VN',
      response_code: 0,
      installments_number: 0,
    };

    it('mapea una transacción autorizada', async () => {
      transaction.commit.mockResolvedValue(webpayResponse);

      await expect(
        new TransbankPaymentGateway().commitTransaction('tok-1'),
      ).resolves.toEqual({
        approved: true,
        status: 'AUTHORIZED',
        responseCode: 0,
        buyOrder: 'buy-order-1',
        amount: 19990,
        authorizationCode: '1213',
        paymentTypeCode: 'VN',
        installmentCount: 0,
        cardLastDigits: '6623',
        transactionDate: new Date('2026-10-07T12:00:00.000Z'),
      });
      expect(transaction.commit).toHaveBeenCalledWith('tok-1');
    });

    it.each([
      ['rechazada por el emisor', { status: 'FAILED', response_code: -1 }],
      [
        'autorizada pero con código de respuesta distinto de 0',
        { response_code: -2 },
      ],
      [
        'sin código de respuesta (todavía sin pagar)',
        { status: 'INITIALIZED', response_code: undefined },
      ],
    ])('una transacción %s no se da por aprobada', async (_name, overrides) => {
      transaction.status.mockResolvedValue({ ...webpayResponse, ...overrides });

      const result = await new TransbankPaymentGateway().getTransactionStatus(
        'tok-1',
      );

      expect(result.approved).toBe(false);
      expect(transaction.status).toHaveBeenCalledWith('tok-1');
    });

    it('traduce el error del SDK a PaymentGatewayUnavailableError', async () => {
      transaction.commit.mockRejectedValue(
        new Error('422\nTransaction already locked\n'),
      );

      await expect(
        new TransbankPaymentGateway().commitTransaction('tok-1'),
      ).rejects.toBeInstanceOf(PaymentGatewayUnavailableError);
    });
  });
});
