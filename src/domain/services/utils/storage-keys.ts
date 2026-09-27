// Carpetas del bucket S3 (ver ../doc/architecture/deployment-architecture.md y
// ../doc/flows/purchase-flow-*.md): "productos-personalizados" son los planes generados por consulta
// (uno por Order), "productos-estandarizados" son los planes predefinidos, subidos manualmente
// (uno por versión de plan, compartido por todos sus compradores).
export const PERSONALIZED_PLANS_PREFIX = 'productos-personalizados';

export function buildPersonalizedPlanKey(orderId: string): string {
  return `${PERSONALIZED_PLANS_PREFIX}/${orderId}.pdf`;
}

// Miniatura WebP de la página 1 del PDF de una Order (vista previa del panel del frontend).
export function buildPlanThumbnailKey(orderId: string): string {
  return `${PERSONALIZED_PLANS_PREFIX}/miniaturas/${orderId}.webp`;
}

export const PREDEFINED_PLANS_PREFIX = 'productos-estandarizados';

// PDF de una versión de plan predefinido. `code` es Product.code (ver predefined-plan-code.ts): el
// archivo se sube a mano con exactamente este nombre y su key se guarda en Product.pdfKey.
export function buildPredefinedPlanKey(code: string): string {
  return `${PREDEFINED_PLANS_PREFIX}/${code}.pdf`;
}

// Miniatura WebP de la página 1 del PDF de una versión de plan predefinido (Product.thumbnailKey).
export function buildPredefinedPlanThumbnailKey(code: string): string {
  return `${PREDEFINED_PLANS_PREFIX}/miniaturas/${code}.webp`;
}
