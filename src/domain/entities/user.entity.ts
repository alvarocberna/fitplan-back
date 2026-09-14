// Mapea los modelos User / AuthIdentity de prisma/schema.prisma (sección IDENTITY & AUTH).
// Los campos de relación son opcionales: solo vienen poblados cuando la consulta a Prisma
// los incluye explícitamente (`include`).

import type {
  ClinicalRecordEntity,
  NutritionalConsultationEntity,
} from './clinical-record.entity';
import type { OrderEntity } from './order.entity';

export type AuthProvider = 'COGNITO' | 'GOOGLE';

export interface UserEntity {
  id: string;

  rut: string | null;
  rutCheckDigit: string | null;
  email: string | null;

  firstName: string | null;
  middleName: string | null;
  paternalLastName: string | null;
  maternalLastName: string | null;

  gender: string | null;

  dateOfBirth: Date | null;
  photoUrl: string | null;

  createdAt: Date;
  updatedAt: Date;

  authIdentities?: AuthIdentityEntity[];
  clinicalRecord?: ClinicalRecordEntity | null;
  nutritionalConsultations?: NutritionalConsultationEntity[];
  orders?: OrderEntity[];
}

export interface AuthIdentityEntity {
  id: string;

  userId: string;
  user?: UserEntity;

  provider: AuthProvider;
  providerUserId: string;

  email: string;
  emailVerified: boolean;
  isPrimary: boolean;

  createdAt: Date;
}
