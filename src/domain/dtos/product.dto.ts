// Forma pública de una versión de plan predefinido (GET /productos/predefinidos/:code). Es un
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
