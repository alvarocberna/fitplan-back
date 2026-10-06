import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { MeasurementsDatasource } from '../../../../domain/datasources/clinical-domain/measurements.datasource';
import { MeasurementsEntity } from '../../../../domain/entities/measurements.entity';
import {
  CreateMeasurementsDto,
  CreateMeasurementWithDetailsDto,
  MeasurementsDateRange,
  UpdateMeasurementsDto,
  UpdateMeasurementWithDetailsDto,
} from '../../../../domain';

// Lista de mediciones (GET /me/measurements): valores básicos, resultados y número de consulta.
const LIST_INCLUDE = {
  basicMeasurements: true,
  measurementResults: true,
  consultation: { select: { consultationNumber: true } },
} satisfies Prisma.MeasurementsInclude;

// Detalle de una medición (GET /me/measurements/:id): todas las hijas.
const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  skinfolds: true,
  circumferences: true,
  diameters: true,
} satisfies Prisma.MeasurementsInclude;

@Injectable()
export class MeasurementsDatasourceImpl implements MeasurementsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createMeasurements(
    createMeasurementsDto: CreateMeasurementsDto,
  ): Promise<MeasurementsEntity> {
    return this.prisma.measurements.create({ data: createMeasurementsDto });
  }

  async getMeasurementsById(id: string): Promise<MeasurementsEntity | null> {
    return this.prisma.measurements.findUnique({ where: { id } });
  }

  async updateMeasurementsById(
    id: string,
    updateMeasurementsDto: UpdateMeasurementsDto,
  ): Promise<MeasurementsEntity> {
    return this.prisma.measurements.update({
      where: { id },
      data: updateMeasurementsDto,
    });
  }

  async deleteMeasurementsById(id: string): Promise<void> {
    await this.prisma.measurements.delete({ where: { id } });
  }

  // El historial clínico es único por paciente (clinical_record.patient_id), así que filtrar por la
  // relación equivale a clinical_record_id = <historial del usuario> y usa el índice
  // (clinical_record_id, measured_at). Incluye ambos orígenes (consulta y registrada por el usuario).
  async getLatestMeasurementsWithResultsByPatientId(
    patientId: string,
  ): Promise<MeasurementsEntity | null> {
    const measurement = await this.prisma.measurements.findFirst({
      where: { clinicalRecord: { patientId } },
      orderBy: { measuredAt: 'desc' },
      include: { basicMeasurements: true, measurementResults: true },
    });
    return measurement as MeasurementsEntity | null;
  }

  async listMeasurementsByPatientId(
    patientId: string,
    range: MeasurementsDateRange = {},
  ): Promise<MeasurementsEntity[]> {
    const measurements = await this.prisma.measurements.findMany({
      where: {
        clinicalRecord: { patientId },
        ...(range.from || range.to
          ? { measuredAt: { gte: range.from, lte: range.to } }
          : {}),
      },
      orderBy: { measuredAt: 'desc' },
      include: LIST_INCLUDE,
    });
    // consultation viene parcial (select), por eso el cast.
    return measurements as unknown as MeasurementsEntity[];
  }

  async getMeasurementDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<MeasurementsEntity | null> {
    // findFirst (no findUnique) para filtrar también por el historial del paciente (R2).
    const measurement = await this.prisma.measurements.findFirst({
      where: { id, clinicalRecord: { patientId } },
      include: DETAIL_INCLUDE,
    });
    return measurement as unknown as MeasurementsEntity | null;
  }

  async getMaxMeasurementNumberByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number> {
    const { _max } = await this.prisma.measurements.aggregate({
      where: { clinicalRecordId },
      _max: { measurementNumber: true },
    });
    return _max.measurementNumber ?? 0;
  }

  async createMeasurementWithDetails(
    dto: CreateMeasurementWithDetailsDto,
  ): Promise<MeasurementsEntity> {
    const { basic, results, ...measurement } = dto;
    const created = await this.prisma.measurements.create({
      data: {
        ...measurement,
        consultationId: null,
        basicMeasurements: { create: [basic] },
        measurementResults: results ? { create: [results] } : undefined,
      },
    });
    return created as MeasurementsEntity;
  }

  async updateMeasurementWithDetails(
    id: string,
    dto: UpdateMeasurementWithDetailsDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (dto.measuredAt) {
        await tx.measurements.update({
          where: { id },
          data: { measuredAt: dto.measuredAt },
        });
      }

      if (dto.basic) {
        const current = await tx.basicMeasurements.findFirst({
          where: { measurementsId: id },
        });
        if (current) {
          await tx.basicMeasurements.update({
            where: { id: current.id },
            data: dto.basic,
          });
        } else if (dto.basic.weight != null && dto.basic.height != null) {
          await tx.basicMeasurements.create({
            data: {
              ...dto.basic,
              weight: dto.basic.weight,
              height: dto.basic.height,
              measurementsId: id,
            },
          });
        }
      }

      if (dto.results) {
        const current = await tx.measurementResults.findFirst({
          where: { measurementsId: id },
        });
        if (current) {
          await tx.measurementResults.update({
            where: { id: current.id },
            data: dto.results,
          });
        } else {
          await tx.measurementResults.create({
            data: { ...dto.results, measurementsId: id },
          });
        }
      }
    });
  }
}
