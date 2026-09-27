import {
  buildPersonalizedPlanKey,
  buildPlanThumbnailKey,
  buildPredefinedPlanKey,
  buildPredefinedPlanThumbnailKey,
} from './storage-keys';

describe('storage-keys', () => {
  describe('keys', () => {
    it('el PDF y su miniatura comparten prefijo y se derivan del orderId', () => {
      expect(buildPersonalizedPlanKey('order-1')).toBe('productos-personalizados/order-1.pdf');
      expect(buildPlanThumbnailKey('order-1')).toBe(
        'productos-personalizados/miniaturas/order-1.webp',
      );
    });
  });

  describe('keys de planes predefinidos', () => {
    it('arma la key del PDF y de la miniatura a partir del code, en productos-estandarizados/', () => {
      expect(buildPredefinedPlanKey('plan-gimnasio-volumen-50-60-m-joven')).toBe(
        'productos-estandarizados/plan-gimnasio-volumen-50-60-m-joven.pdf',
      );
      expect(buildPredefinedPlanThumbnailKey('plan-gimnasio-volumen-50-60-m-joven')).toBe(
        'productos-estandarizados/miniaturas/plan-gimnasio-volumen-50-60-m-joven.webp',
      );
    });
  });
});
