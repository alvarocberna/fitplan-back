import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { NutritionalConsultationDatasource } from '../../../../domain/datasources/clinical-domain/nutritional-consultation.datasource';
import { NutritionalConsultationEntity } from '../../../../domain/entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
  CreateNutritionalConsultationDetailsDto,
} from '../../../../domain';

// Árbol completo de la consulta (Anamnesis+hijas, Measurements+hija), reutilizado tanto por el
// nested create como por la lectura enriquecida. No incluye anamnesisPsychosocial ni supplements
// porque hoy no hay datos fuente para poblarlos (ver CompleteConsultationDto).
const FULL_DETAILS_INCLUDE = {
  anamneses: {
    include: {
      goals: true,
      anamnesisClinical: true,
      anamnesisDietary: {
        include: {
          dietaryRecalls24h: { include: { meals: true } },
          foodPreferences: { include: { groups: true } },
        },
      },
      lifestyles: { include: { sportsSessions: true, sportsStrategies: true } },
    },
  },
  measurements: { include: { basicMeasurements: true } },
} satisfies Prisma.NutritionalConsultationInclude;

type NutritionalConsultationWithDetails =
  Prisma.NutritionalConsultationGetPayload<{
    include: typeof FULL_DETAILS_INCLUDE;
  }>;

// Árbol reducido para el resumen del panel (GET /me/summary): identidad del paciente, objetivo
// (Anamnesis.Goals) y datos básicos del último plan nutricional generado (el NutritionalPlan
// principal de cada Plan activo).
const PANEL_DETAILS_INCLUDE = {
  patient: true,
  anamneses: { include: { goals: true } },
  plans: {
    where: { active: true },
    include: { nutritionalPlans: { where: { mainPlan: true } } },
  },
} satisfies Prisma.NutritionalConsultationInclude;

type NutritionalConsultationWithPanelDetails =
  Prisma.NutritionalConsultationGetPayload<{
    include: typeof PANEL_DETAILS_INCLUDE;
  }>;

// Árbol para el listado de consultas (GET /me/consultations): objetivo, estados de la orden (solo
// lectura; la orden la escribe billing) y resumen del plan activo -> NutritionalPlan principal.
const LIST_WITH_STATUS_INCLUDE = {
  anamneses: { include: { goals: true } },
  order: { select: { id: true, paymentStatus: true, generationStatus: true } },
  plans: {
    where: { active: true },
    include: { nutritionalPlans: { where: { mainPlan: true } } },
  },
} satisfies Prisma.NutritionalConsultationInclude;

// Árbol para el detalle de una consulta (GET /me/consultations/:id): lo mismo que el listado más las
// mediciones tomadas en la consulta (la relación ya filtra consultation_id = la consulta, así que no
// incluye las registradas por el usuario) y, de la orden, lo necesario para firmar la descarga del PDF.
const DETAIL_WITH_STATUS_INCLUDE = {
  ...LIST_WITH_STATUS_INCLUDE,
  order: {
    select: {
      id: true,
      paymentStatus: true,
      generationStatus: true,
      pdfKey: true,
      creationDate: true,
    },
  },
  measurements: {
    orderBy: { measuredAt: 'asc' },
    include: { basicMeasurements: true, measurementResults: true },
  },
} satisfies Prisma.NutritionalConsultationInclude;

@Injectable()
export class NutritionalConsultationDatasourceImpl
  implements NutritionalConsultationDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  // `SportsSession.eventType` se guarda como String (sin enum nativo en el schema); es el único
  // campo "enum-as-string" en todo este árbol, por eso se castea con un cast puntual al final en
  // vez de mapear entidad por entidad como en los datasources planos.
  private toEntity(
    consultation: NutritionalConsultationWithDetails,
  ): NutritionalConsultationEntity {
    return consultation as unknown as NutritionalConsultationEntity;
  }

  async createNutritionalConsultation(
    createNutritionalConsultationDto: CreateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.prisma.nutritionalConsultation.create({
      data: createNutritionalConsultationDto,
    });
  }

  async getNutritionalConsultationById(
    id: string,
  ): Promise<NutritionalConsultationEntity | null> {
    return this.prisma.nutritionalConsultation.findUnique({
      where: { id },
    });
  }

  async updateNutritionalConsultationById(
    id: string,
    updateNutritionalConsultationDto: UpdateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.prisma.nutritionalConsultation.update({
      where: { id },
      data: updateNutritionalConsultationDto,
    });
  }

  async deleteNutritionalConsultationById(id: string): Promise<void> {
    await this.prisma.nutritionalConsultation.delete({
      where: { id },
    });
  }

  async createNutritionalConsultationWithDetails(
    dto: CreateNutritionalConsultationDetailsDto,
  ): Promise<NutritionalConsultationEntity> {
    const { consultation, anamnesis, measurements } = dto;

    const created = await this.prisma.nutritionalConsultation.create({
      data: {
        ...consultation,
        anamneses: anamnesis
          ? {
              create: [
                {
                  goals: anamnesis.goals
                    ? { create: anamnesis.goals }
                    : undefined,
                  anamnesisClinical: anamnesis.clinical
                    ? { create: anamnesis.clinical }
                    : undefined,
                  anamnesisDietary: anamnesis.dietary
                    ? {
                        create: {
                          dietType: anamnesis.dietary.dietType,
                          dietaryRecalls24h: anamnesis.dietary.r24hMeals.length
                            ? {
                                create: [
                                  {
                                    meals: {
                                      create: anamnesis.dietary.r24hMeals,
                                    },
                                  },
                                ],
                              }
                            : undefined,
                          foodPreferences: anamnesis.dietary
                            .foodPreferenceGroups.length
                            ? {
                                create: [
                                  {
                                    group: null,
                                    groups: {
                                      create:
                                        anamnesis.dietary.foodPreferenceGroups,
                                    },
                                  },
                                ],
                              }
                            : undefined,
                        },
                      }
                    : undefined,
                  lifestyles: anamnesis.lifestyle
                    ? {
                        create: [
                          {
                            tobacco: anamnesis.lifestyle.tobacco,
                            alcohol: anamnesis.lifestyle.alcohol,
                            physicalActivityLevel:
                              anamnesis.lifestyle.physicalActivityLevel,
                            sport: anamnesis.lifestyle.sport,
                            sportsSessions: anamnesis.lifestyle.sportsSessions
                              .length
                              ? { create: anamnesis.lifestyle.sportsSessions }
                              : undefined,
                            sportsStrategies: anamnesis.lifestyle
                              .sportsStrategies.length
                              ? { create: anamnesis.lifestyle.sportsStrategies }
                              : undefined,
                          },
                        ],
                      }
                    : undefined,
                },
              ],
            }
          : undefined,
        measurements: measurements
          ? {
              create: [
                {
                  clinicalRecordId: consultation.clinicalRecordId,
                  measuredAt: measurements.measuredAt,
                  measurementNumber: measurements.measurementNumber,
                  level: measurements.level,
                  description: measurements.description,
                  basicMeasurements: measurements.basicMeasurements
                    ? { create: measurements.basicMeasurements }
                    : undefined,
                },
              ],
            }
          : undefined,
      },
      include: FULL_DETAILS_INCLUDE,
    });

    return this.toEntity(created);
  }

  async getNutritionalConsultationWithDetailsByOrderId(
    orderId: string,
  ): Promise<NutritionalConsultationEntity | null> {
    const consultation = await this.prisma.nutritionalConsultation.findUnique({
      where: { orderId },
      include: FULL_DETAILS_INCLUDE,
    });
    return consultation ? this.toEntity(consultation) : null;
  }

  async getLatestNutritionalConsultationWithDetailsByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null> {
    const consultation: NutritionalConsultationWithPanelDetails | null =
      await this.prisma.nutritionalConsultation.findFirst({
        // Solo consultas con plan generado: la consulta se crea antes del pago, así que la más
        // reciente puede no tener plan todavía y el panel mostraría datos sin su plan.
        where: {
          patientId,
          plans: {
            some: {
              active: true,
              nutritionalPlans: { some: { mainPlan: true } },
            },
          },
        },
        orderBy: { consultationNumber: 'desc' },
        include: PANEL_DETAILS_INCLUDE,
      });
    return consultation
      ? (consultation as unknown as NutritionalConsultationEntity)
      : null;
  }

  async countNutritionalConsultationsByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number> {
    return this.prisma.nutritionalConsultation.count({
      where: { clinicalRecordId },
    });
  }

  async getNutritionalConsultationsWithStatusByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity[]> {
    const consultations = await this.prisma.nutritionalConsultation.findMany({
      where: { patientId },
      orderBy: [{ consultationDate: 'desc' }, { consultationNumber: 'desc' }],
      include: LIST_WITH_STATUS_INCLUDE,
    });
    // order viene parcial (select), por eso el cast.
    return consultations as unknown as NutritionalConsultationEntity[];
  }

  async getNutritionalConsultationDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null> {
    // findFirst (no findUnique) para filtrar también por patientId: ajena o inexistente -> null (R2).
    const consultation = await this.prisma.nutritionalConsultation.findFirst({
      where: { id, patientId },
      include: DETAIL_WITH_STATUS_INCLUDE,
    });
    return consultation as unknown as NutritionalConsultationEntity | null;
  }
}
