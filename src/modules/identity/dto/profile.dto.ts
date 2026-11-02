import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { calculateAge } from '../../../domain';
import { UserEntity } from '../../../domain/entities/user.entity';

// Body de POST /me/sync. `email` es opcional y se IGNORA (queda solo para no rechazar a un cliente
// antiguo): el email de la cuenta se obtiene de Cognito, nunca del cliente.
export class SyncIdentityDtoImpl {
  @IsEmail()
  @MaxLength(254)
  @IsOptional()
  email?: string;
}

// Único DTO de PATCH /me: todos los campos son opcionales y solo se actualizan los que vienen. Sin
// email (se fija al sincronizar la identidad y no se edita por acá, para no desincronizarlo de la
// cuenta de Cognito) ni photoUrl (no hay flujo de carga de foto).
export class UpdateProfileDtoImpl {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  rut?: string | null;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  rutCheckDigit?: string | null;

  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  @IsOptional()
  firstName?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  middleName?: string | null;

  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  @IsOptional()
  paternalLastName?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  maternalLastName?: string | null;

  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsBoolean()
  @IsOptional()
  athlete?: boolean;
}

// Respuesta común de POST /me/sync, GET /me y PATCH /me.
export interface ProfileDto {
  email: string | null;
  rut: string | null;
  rutCheckDigit: string | null;
  firstName: string | null;
  middleName: string | null;
  paternalLastName: string | null;
  maternalLastName: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  age: number | null;
  athlete: boolean;
  photoUrl: string | null;
  profileComplete: boolean;
}

export function toProfileDto(
  user: UserEntity,
  profileComplete: boolean,
): ProfileDto {
  return {
    email: user.email,
    rut: user.rut,
    rutCheckDigit: user.rutCheckDigit,
    firstName: user.firstName,
    middleName: user.middleName,
    paternalLastName: user.paternalLastName,
    maternalLastName: user.maternalLastName,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null,
    athlete: user.athlete,
    photoUrl: user.photoUrl,
    profileComplete,
  };
}
