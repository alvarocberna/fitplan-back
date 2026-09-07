import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from './retention.service';
import { OrdersService } from './orders.service';

// El 'cron' real de CronJob.start() deja un timer vivo indefinidamente (se dispara recién a las
// 03:00): sin mockear el paquete, cada test filtraría un handle abierto y Jest terminaría el
// proceso a la fuerza. Se reemplaza por un stub que solo captura el callback, sin programar nada.
jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation((_pattern: string, onTick: () => void) => ({
    onTick,
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('RetentionService', () => {
  let service: RetentionService;
  let ordersService: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        {
          provide: OrdersService,
          useValue: { cleanupOldOrders: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(RetentionService);
    ordersService = module.get(OrdersService);
  });

  // runCleanup es privado: se invoca a través de la función que onModuleInit registra en el
  // CronJob, sin depender de que el cron real se dispare (ver retention.service.ts).
  function getScheduledCallback(): () => Promise<void> {
    service.onModuleInit();
    return (service as any).runCleanup.bind(service);
  }

  it('invoca cleanupOldOrders con la retención de 45 días configurada', async () => {
    ordersService.cleanupOldOrders.mockResolvedValue(2);
    const runCleanup = getScheduledCallback();

    await runCleanup();

    expect(ordersService.cleanupOldOrders).toHaveBeenCalledWith(45);
  });

  it('si cleanupOldOrders falla, el error queda contenido (no se propaga)', async () => {
    ordersService.cleanupOldOrders.mockRejectedValue(new Error('DB caída'));
    const runCleanup = getScheduledCallback();

    await expect(runCleanup()).resolves.toBeUndefined();
  });
});
