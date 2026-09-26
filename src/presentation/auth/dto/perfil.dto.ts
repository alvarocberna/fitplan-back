import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class SincronizarPerfilDtoImpl {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

// Sin email: es de solo lectura, se fija al sincronizar (ver SincronizarPerfilDtoImpl) y no se
// actualiza por acá — evita que el perfil quede desincronizado del email real de la cuenta.
export class ActualizarPerfilDtoImpl {
  @IsString()
  @IsOptional()
  rut?: string | null;

  @IsString()
  @IsOptional()
  rutCheckDigit?: string | null;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsOptional()
  middleName?: string | null;

  @IsString()
  @IsNotEmpty()
  paternalLastName!: string;

  @IsString()
  @IsOptional()
  maternalLastName?: string | null;

  @IsString()
  @IsNotEmpty()
  gender!: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  // Opcional: si no viene, se conserva el valor actual del perfil.
  @IsBoolean()
  @IsOptional()
  athlete?: boolean;
}

export interface PerfilResponseDto {
  firstName: string | null;
  middleName: string | null;
  paternalLastName: string | null;
  maternalLastName: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  athlete: boolean;
  email: string | null;
  rut: string | null;
  rutCheckDigit: string | null;
  profileComplete: boolean;
}
