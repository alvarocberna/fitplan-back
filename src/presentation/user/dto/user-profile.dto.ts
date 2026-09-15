import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

// Solo los campos básicos editables desde /features/profile en el frontend: nombre, apellido
// (paternalLastName) y fecha de nacimiento. El email es de solo lectura (se fija al sincronizar
// la identidad vía POST /auth/perfil) y no se acepta acá.
export class UpdateUserProfileDtoImpl {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  paternalLastName!: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;
}

export interface UserProfileResponseDto {
  firstName: string | null;
  paternalLastName: string | null;
  dateOfBirth: Date | null;
  email: string | null;
}
