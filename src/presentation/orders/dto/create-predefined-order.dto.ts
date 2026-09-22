import { Matches } from 'class-validator';
import { PREDEFINED_PLAN_CODE_REGEX } from '../../../domain';

export class CreatePredefinedOrderDtoImpl {
  //<plan>-<pesoMin>-<pesoMax>-<sexo>-<edad>, p. ej. 'plan-gimnasio-volumen-50-60-m-joven'
  @Matches(PREDEFINED_PLAN_CODE_REGEX, {
    message: 'code no corresponde a una versión válida de plan predefinido',
  })
  code!: string;
}
