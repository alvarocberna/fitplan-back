import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { dirname, join, sep } from 'node:path';

// Ancho de la miniatura: ~2x el ancho con el que la muestra el panel (tarjeta de ~280-400px), para
// que se vea nítida en pantallas retina sin pesar más de ~30-150 KB en WebP.
const THUMBNAIL_WIDTH_PX = 800;
const THUMBNAIL_WEBP_QUALITY = 80;

// pdfjs necesita las fuentes estándar (Helvetica -> LiberationSans) para dibujar el texto tal como
// lo generó @react-pdf/renderer; sin ellas cae a una fuente del sistema y el texto se deforma. En
// Node se pasa como ruta del sistema de archivos (no como URL file://) y pdfjs exige que termine en
// "/" — también en Windows, donde path.sep es "\", por eso se normalizan los separadores.
const STANDARD_FONTS_DIR =
  join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
    .split(sep)
    .join('/') + '/';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  // Rasteriza la página 1 del PDF a WebP. pdfjs-dist es ESM puro, por eso se importa dinámicamente
  // (el build de Nest es CJS con module nodenext); se usa el build "legacy" que es el compatible con
  // Node. Puede lanzar: el llamador decide si el fallo es fatal (en la generación del plan no lo es).
  async generateFirstPage(pdfBuffer: Buffer): Promise<Buffer> {
    const startedAt = Date.now();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      standardFontDataUrl: STANDARD_FONTS_DIR,
    });

    try {
      const document = await loadingTask.promise;
      const page = await document.getPage(1);

      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: THUMBNAIL_WIDTH_PX / baseViewport.width,
      });

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await page.render({
        // pdfjs tipa el canvas del DOM; el de @napi-rs/canvas es compatible en lo que usa pdfjs.
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvas.getContext(
          '2d',
        ) as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const webp = await canvas.encode('webp', THUMBNAIL_WEBP_QUALITY);
      this.logger.log(
        `Miniatura generada: ${canvas.width}x${canvas.height}, ${webp.length} bytes, ` +
          `${Date.now() - startedAt}ms`,
      );
      return webp;
    } finally {
      await loadingTask.destroy();
    }
  }
}
