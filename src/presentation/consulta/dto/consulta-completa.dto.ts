import { IsString, IsNumber, IsInt, IsOptional, IsEmail, IsNotEmpty, IsDateString, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConsultaCompletaDto,
  InformacionPersonalDto,
  AnamnesisClinicaDto,
  AnamnesisAlimentariaDto,
  EstiloVidaSaludableDto,
  AnamnesisDto,
  MedicionesDto,
  Comida,
  EstrategiaDeportiva,
  ObjetivosDto,
  GrupoPreferenciasAlimentarias,
} from '../../../domain';

export class InformacionPersonalDtoImpl implements InformacionPersonalDto {

  @Type(() => Number)
  @IsNumber()
  rut!: number | null;

  @IsString()
  dv_rut!: string | null;

  @IsString()
  @IsNotEmpty()
  nombre_primero!: string | null;

  @IsString()
  @IsOptional()
  nombre_segundo!: string | null;

  @IsString()
  @IsNotEmpty()
  apellido_paterno!: string | null;

  @IsString()
  @IsOptional()
  apellido_materno!: string | null;

  
  @IsString()
  @IsNotEmpty()
  genero!: string | null;

  @IsBoolean()
  @IsNotEmpty()
  deportista!: boolean | null;

  @IsEmail()
  @IsOptional()
  correo!: string | null;

  // @IsInt()
  // @IsOptional()
  // celular!: number | null;

  @IsDateString()
  @IsNotEmpty()
  fecha_nacimiento!: Date | null;
}

export class ObjetivosDtoImpl implements ObjetivosDto {
  @IsString()
  @IsOptional()
  objetivo_principal!: string | null;

  @IsString()
  @IsOptional()
  objetivo_secundario!: string[] | null;
}


export class AnamnesisClinicaDtoImpl implements AnamnesisClinicaDto {
  @IsString()
  @IsOptional()
  patologia!: string | null;

  @IsString()
  @IsOptional()
  antecedentes_morbidos_familiares!: string | null;

  @IsString()
  @IsOptional()
  alergias!: string | null;

  @IsString()
  @IsOptional()
  intolerancias!: string | null;

  @IsString()
  @IsOptional()
  farmacos!: string | null;

  @IsString()
  @IsOptional()
  antecedentes_gastrointestinales!: string | null;

  @IsString()
  @IsOptional()
  deposiciones!: string | null;

  @IsString()
  @IsOptional()
  cirugias!: string | null;
}

export class ComidaDtoImpl implements Comida {
  @IsString()
  tiempo_de_comida!: string | null;

  @IsString()
  @IsOptional()
  carbohidrato!: string | null;

  @IsString()
  @IsOptional()
  verdura_libre_consumo!: string | null;

  @IsString()
  @IsOptional()
  verdura_consumo_general!: string | null;

  @IsString()
  @IsOptional()
  fruta!: string | null;

  @IsString()
  @IsOptional()
  proteina_alta_en_grasa!: string | null;

  @IsString()
  @IsOptional()
  proteina_baja_en_grasa!: string | null;

  @IsString()
  @IsOptional()
  lacteo_alto_en_grasa!: string | null;

  @IsString()
  @IsOptional()
  lacteo_medio_en_grasa!: string | null;

  @IsString()
  @IsOptional()
  lacteo_bajo_en_grasa!: string | null;

  @IsString()
  @IsOptional()
  rico_en_lipidos!: string | null;

  @IsString()
  @IsOptional()
  aceite!: string | null;

  @IsString()
  @IsOptional()
  azucar!: string | null;

  @IsString()
  @IsOptional()
  alcohol!: string | null;
}

export class EstrategiaDeportivaDtoImpl implements EstrategiaDeportiva {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  suplemento!: string[] | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hidratacion!: string[] | null;

  @IsString()
  @IsOptional()
  comida_pre_actividad!: string | null;

  @IsString()
  @IsOptional()
  comida_durante_actividad!: string | null;

  @IsString()
  @IsOptional()
  comida_post_actividad!: string | null;
}

export class GrupoPreferenciasAlimentariasDtoImpl implements GrupoPreferenciasAlimentarias {
  @IsString()
  grupo!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  consumoFrecuente!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  consumoOcasional!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  consumoRaro!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  alimentosEvitados!: string[];
}

export class AnamnesisAlimentariaDtoImpl implements AnamnesisAlimentariaDto {
  @ValidateNested({ each: true })
  @Type(() => ComidaDtoImpl)
  @IsOptional()
  r24h!: ComidaDtoImpl[] | null;

  @ValidateNested({ each: true })
  @Type(() => GrupoPreferenciasAlimentariasDtoImpl)
  @IsOptional()
  grupo_preferencias_alimentarias!: GrupoPreferenciasAlimentariasDtoImpl[] | null;

  @ValidateNested()
  @Type(() => EstrategiaDeportivaDtoImpl)
  @IsOptional()
  estrategia_deportiva!: EstrategiaDeportivaDtoImpl;
}

export class SesionDeportivaDtoImpl {
  @IsString()
  @IsOptional()
  descripcion!: string | null;

  @IsString()
  @IsOptional()
  disciplina!: string | null;

  @IsNumber()
  @IsOptional()
  duracion!: number | null;

  @IsString()
  @IsOptional()
  intensidad!: string | null;

  @IsString()
  @IsOptional()
  tipo_evento!: string | null;

  @IsString()
  @IsOptional()
  dias!: string | null;

  @IsString()
  @IsOptional()
  horario!: string | null;
}

export class EstiloVidaSaludableDtoImpl implements EstiloVidaSaludableDto {
  @IsString()
  @IsOptional()
  alcohol!: string | null;

  @IsString()
  @IsOptional()
  tabaco!: string | null;

  @IsString()
  @IsOptional()
  nivel_actividad_fisica!: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deporte!: string[] | null;

  @ValidateNested({ each: true })
  @Type(() => SesionDeportivaDtoImpl)
  @IsOptional()
  sesion_deportiva!: SesionDeportivaDtoImpl[] | null;
}

export class AnamnesisDtoImpl implements AnamnesisDto {
  @ValidateNested()
  @Type(() => ObjetivosDtoImpl)
  @IsOptional()
  objetivos!: ObjetivosDtoImpl | null;

  @ValidateNested()
  @Type(() => AnamnesisClinicaDtoImpl)
  @IsOptional()
  clinica!: AnamnesisClinicaDtoImpl | null;

  @ValidateNested()
  @Type(() => AnamnesisAlimentariaDtoImpl)
  @IsOptional()
  alimentaria!: AnamnesisAlimentariaDtoImpl | null;

  @ValidateNested()
  @Type(() => EstiloVidaSaludableDtoImpl)
  @IsOptional()
  estilo_vida!: EstiloVidaSaludableDtoImpl | null;
}

export class MedicionesDtoImpl implements MedicionesDto {
  @IsNumber()
  peso!: number | null;

  @IsNumber()
  talla!: number | null;

  @IsString()
  @IsOptional()
  somatotipo!: string | null;

  // @IsNumber()
  // talla_sentado!: number | null;

  // @IsNumber()
  // envergadura!: number | null;

  // @IsNumber()
  // tricep!: number | null;

  // @IsNumber()
  // subescapular!: number | null;

  // @IsNumber()
  // bicep!: number | null;

  // @IsNumber()
  // cresta_iliaca!: number | null;

  // @IsNumber()
  // supraespinal!: number | null;

  // @IsNumber()
  // abdominal!: number | null;

  // @IsNumber()
  // muslo!: number | null;

  // @IsNumber()
  // pierna_pli!: number | null;

  // @IsNumber()
  // brazo_relajado!: number | null;

  // @IsNumber()
  // brazo_flexionado!: number | null;

  // @IsNumber()
  // cintura!: number | null;

  // @IsNumber()
  // cadera!: number | null;

  // @IsNumber()
  // muslo_medio!: number | null;

  // @IsNumber()
  // pierna_per!: number | null;

  // @IsNumber()
  // humero!: number | null;

  // @IsNumber()
  // biestiloideo!: number | null;

  // @IsNumber()
  // femur!: number | null;
}

export class ConsultaCompletaDtoImpl implements ConsultaCompletaDto {
  @ValidateNested()
  @Type(() => InformacionPersonalDtoImpl)
  informacion_personal!: InformacionPersonalDtoImpl | null;

  @ValidateNested()
  @Type(() => AnamnesisDtoImpl)
  anamnesis!: AnamnesisDtoImpl | null;

  @ValidateNested()
  @Type(() => MedicionesDtoImpl)
  mediciones!: MedicionesDtoImpl | null;
}
