// Input para UserDatasource.findOrCreateUserByEmail: si ya existe un User con ese email se
// reutiliza tal cual (estos datos NO actualizan el registro existente); si no existe, se crea con
// estos datos. Usado por SyncIdentityUseCase (POST /me/sync) al primer login — solo el email está
// garantizado ahí (Cognito no da nombre/género/fecha de nacimiento); el resto del perfil se
// completa después vía PATCH /me.
export interface FindOrCreateUserByEmailDto {
  email: string;
  rut?: string | null;
  rutCheckDigit?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | null;
}
