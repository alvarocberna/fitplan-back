import { Module } from '@nestjs/common';
import { ProductDatasource } from '../../../domain/datasources/commercial-domain/product.datasource';
import { ProductDatasourceImpl } from './product.datasource';
import { OrderDatasource } from '../../../domain/datasources/commercial-domain/order.datasource';
import { OrderDatasourceImpl } from './order.datasource';
import { PaymentDatasource } from '../../../domain/datasources/commercial-domain/payment.datasource';
import { PaymentDatasourceImpl } from './payment.datasource';

// Ata cada clase abstracta de domain/datasources/commercial-domain a su implementación concreta
// (Prisma). Los módulos consumidores inyectan el token abstracto (ej. ProductDatasource), nunca
// el *Impl, para no acoplarse a Prisma.
@Module({
  providers: [
    { provide: ProductDatasource, useClass: ProductDatasourceImpl },
    { provide: OrderDatasource, useClass: OrderDatasourceImpl },
    { provide: PaymentDatasource, useClass: PaymentDatasourceImpl },
  ],
  exports: [ProductDatasource, OrderDatasource, PaymentDatasource],
})
export class CommercialDomainDatasourcesModule {}
