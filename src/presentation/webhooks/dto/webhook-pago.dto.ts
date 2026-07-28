import { IsUUID } from 'class-validator';

export class WebhookPagoDtoImpl {
  @IsUUID('4')
  orden_id!: string;
}
