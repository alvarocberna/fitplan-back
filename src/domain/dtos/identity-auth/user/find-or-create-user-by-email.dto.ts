// Input para UserDatasource.findOrCreateUserByEmail: si ya existe un User con ese email se
// reutiliza tal cual (estos datos NO actualizan el registro existente); si no existe, se crea con
// estos datos. Usado por OrdersService.createOrder, que no tiene ningún flujo de login/registro
// real detrás — el email de personalInfo es la única identidad disponible hoy.
export interface FindOrCreateUserByEmailDto {
  email: string;
  rut: string | null;
  rutCheckDigit: string | null;
  firstName: string;
  middleName: string | null;
  paternalLastName: string;
  maternalLastName: string | null;
  gender: string;
  dateOfBirth: Date;
}
