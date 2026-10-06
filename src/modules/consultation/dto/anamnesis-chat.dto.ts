import { IsString, IsNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, ValidateNested, MaxLength, ArrayMaxSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ChatMessageDto, InputChatDto, OutputChatDto } from '../../../domain';
import type { ChatRole } from '../../../domain';
import { AnamnesisDtoImpl } from './consultation.dto';
import { normalizeAnamnesisPayload } from './anamnesis-normalizer';

// El historial completo viaja en cada turno y entra al prompt: sin tope, un cliente podría mandar
// conversaciones enormes y disparar el costo en tokens.
export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_MAX_MESSAGES = 80;

export class ChatMessageDtoImpl implements ChatMessageDto {
  @IsIn(['user', 'assistant'] satisfies ChatRole[])
  role!: ChatRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_MESSAGE_MAX_LENGTH)
  content!: string;
}

export class InputChatDtoImpl implements InputChatDto {
  @IsArray()
  @ArrayMaxSize(CHAT_MAX_MESSAGES)
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
