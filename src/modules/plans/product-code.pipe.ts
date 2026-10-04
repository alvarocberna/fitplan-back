import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { isPredefinedPlanCode } from '../../domain/services/utils/predefined-plan-code';

// Valida el formato del código de un plan estándar antes de tocar la base. Un código con otra forma
// no puede existir: se responde el mismo 404 que para un plan no disponible.
@Injectable()
export class ParseProductCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isPredefinedPlanCode(value)) {
      throw new NotFoundException('Plan no disponible');
    }
    return value;
  }
}
