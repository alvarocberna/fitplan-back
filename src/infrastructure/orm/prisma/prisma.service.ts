import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // SQLite en modo WAL: permite lecturas concurrentes mientras se escribe
    // (el webhook de pago y el worker de generación escriben desde requests distintas).
    // PRAGMA journal_mode devuelve una fila con el modo resultante, por eso se usa
    // $queryRawUnsafe (no $executeRawUnsafe, que en SQLite falla si la consulta retorna filas).
    await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    this.logger.log('Conectado a la base de datos (SQLite, modo WAL)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
