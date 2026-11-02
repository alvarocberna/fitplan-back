import { FileStorage } from '../../domain/ports';

// Nombre con el que el navegador guarda el PDF al descargarlo (solo dígitos y guiones en la parte
// variable, así que es seguro dentro del header Content-Disposition).
export function buildPlanDownloadFilename(creationDate: Date): string {
  return `plan-nutricional-${creationDate.toISOString().slice(0, 10)}.pdf`;
}

export interface SignedPlanFiles {
  pdfUrl: string | null;
  thumbnailUrl: string | null;
}

// R4 (use-cases.md): en la base se guardan keys de S3 y al cliente solo se le entregan URLs
// firmadas de corta duración. El PDF se firma como descarga (attachment); la miniatura, inline.
// Lo comparten GET /orders/:id/status y GET /me/plans.
export async function signPlanFiles(
  storage: FileStorage,
  order: {
    pdfKey: string | null;
    thumbnailKey: string | null;
    creationDate: Date;
  },
): Promise<SignedPlanFiles> {
  const [pdfUrl, thumbnailUrl] = await Promise.all([
    order.pdfKey
      ? storage.getSignedDownloadUrl(order.pdfKey, undefined, {
          downloadFilename: buildPlanDownloadFilename(order.creationDate),
        })
      : null,
    order.thumbnailKey
      ? storage.getSignedDownloadUrl(order.thumbnailKey)
      : null,
  ]);
  return { pdfUrl, thumbnailUrl };
}
