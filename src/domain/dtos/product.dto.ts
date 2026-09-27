// Forma pública de una versión de plan predefinido (GET /plans/standard/:code). Es un
// endpoint sin sesión, así que NO expone pdfKey ni thumbnailKey: solo lo que la ficha del plan
// necesita para mostrarse antes de comprar.
export interface PredefinedProductDto {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  // URL firmada (corta duración) de la miniatura WebP de la versión; null si aún no tiene miniatura.
  thumbnailUrl: string | null;
}

// Forma pública de una fila "vista previa" de un plan predefinido (GET /plans/standard/previews),
// una por familia (code = solo el slug del plan, sin peso/sexo/edad). Usado por el carrusel del home
// para no depender de una imagen estática. No expone price/currency (no se muestran ahí) ni pdfKey.
export interface PredefinedPlanPreviewDto {
  code: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
}
