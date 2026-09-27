import { IsString, IsNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ChatMessageDto, InputChatDto, OutputChatDto } from '../../../domain';
import type { ChatRole } from '../../../domain';
import { AnamnesisDtoImpl } from './consultation.dto';
import { normalizeAnamnesisPayload } from './anamnesis-normalizer';

export class ChatMessageDtoImpl implements ChatMessageDto {
  @IsIn(['user', 'assistant'] satisfies ChatRole[])
  role!: ChatRole;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class InputChatDtoImpl implements InputChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDtoImpl)
  messages!: ChatMessageDtoImpl[];

  // Repara la forma del JSON (campos anidados, arrays donde se espera texto, claves
  // desconocidas, etc.) ANTES de que corra la validación, ya que este campo viaja de
  // vuelta con lo último que devolvió el LLM y puede desviarse del esquema esperado.
  @Transform(({ value }) => normalizeAnamnesisPayload(value))
  @ValidateNested()
  @IsOptional()
  anamnesis!: AnamnesisDtoImpl;
}

export class OutputChatDtoImpl implements OutputChatDto {
  @IsString()
  @IsNotEmpty()
  reply!: string;

  @IsString()
  @IsNotEmpty()
  titleReply!: string;

  @ValidateNested()
  @Type(() => AnamnesisDtoImpl)
  anamnesis!: AnamnesisDtoImpl;

  @IsBoolean()
  isComplete!: boolean;
}
