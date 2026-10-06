import { Module } from '@nestjs/common';
import { EmailSender } from '../../domain/ports';
import { LogEmailSender } from './log-email-sender';

@Module({
  providers: [{ provide: EmailSender, useClass: LogEmailSender }],
  exports: [EmailSender],
})
export class EmailModule {}
