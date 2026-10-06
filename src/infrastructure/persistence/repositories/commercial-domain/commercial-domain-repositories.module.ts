import { Module } from '@nestjs/common';
import { CommercialDomainDatasourcesModule } from '../../datasources/commercial-domain/commercial-domain-datasources.module';
import { ProductRepository } from '../../../../domain/repositories/commercial-domain/product.repository';
import { ProductRepositoryImpl } from './product.repository';
import { OrderRepository } from '../../../../domain/repositories/commercial-domain/order.repository';
import { OrderRepositoryImpl } from './order.repository';
import { PaymentRepository } from '../../../../domain/repositories/commercial-domain/payment.repository';
import { PaymentRepositoryImpl } from './payment.repository';

// Ata cada clase abstracta de domain/repositories/commercial-domain a su implementación concreta,
// que a su vez delega en el datasource correspondiente (ver CommercialDomainDatasourcesModule). Los
// módulos consumidores inyectan el token abstracto (ej. ProductRepository), nunca el *Impl.
@Module({
  imports: [CommercialDomainDatasourcesModule],
  providers: [
    { provide: ProductRepository, useClass: ProductRepositoryImpl },
    { provide: OrderRepository, useClass: OrderRepositoryImpl },
    { provide: PaymentRepository, useClass: PaymentRepositoryImpl },
  ],
  exports: [ProductRepository, OrderRepository, PaymentRepository],
})
export class CommercialDomainRepositoriesModule {}
