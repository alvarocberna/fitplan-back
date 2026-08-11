
export interface InformacionPersonalDto {
    rut: number | null
    dv_rut: string | null
    nombre_primero: string | null
    nombre_segundo: string | null
    apellido_paterno: string | null
    apellido_materno: string | null
    genero: string | null
    deportista: boolean | null    
    correo: string | null
    fecha_nacimiento: Date | null
}

export interface ObjetivosDto{
    objetivo_principal: string | null
    objetivo_secundario: string[] | null
}

export interface AnamnesisClinicaDto {
    patologia: string | null
    antecedentes_morbidos_familiares: string | null
    alergias: string | null
    intolerancias: string | null
    farmacos: string | null
    antecedentes_gastrointestinales: string | null
    deposiciones: string | null
    cirugias: string | null
}

export interface AnamnesisAlimentariaDto {
    r24h: Comida[] | null,
    grupo_preferencias_alimentarias: GrupoPreferenciasAlimentarias[] | null,
    estrategia_deportiva: EstrategiaDeportiva | null,
}

export interface Comida {
    tiempo_de_comida: string | null
    carbohidrato: string | null 
    verdura_libre_consumo: string | null
    verdura_consumo_general: string | null 
    fruta: string | null
    proteina_alta_en_grasa: string | null 
    proteina_baja_en_grasa: string | null
    lacteo_alto_en_grasa: string | null
    lacteo_medio_en_grasa: string | null
    lacteo_bajo_en_grasa: string | null 
    lacteo_alto_en_proteina: string | null
    rico_en_lipidos: string | null
    aceite: string | null
    azucar: string | null
    alcohol: string | null
}

export interface GrupoPreferenciasAlimentarias {
  grupo: string;
  consumoFrecuente: string[];
  consumoOcasional: string[];
  consumoRaro: string[];
  alimentosEvitados: string[];
}

export interface EstrategiaDeportiva {
    suplemento: string[] | null
    hidratacion: string[] | null
    comida_pre_actividad: string | null
    comida_durante_actividad: string | null
    comida_post_actividad: string | null
}

export interface EstiloVidaSaludableDto {
    alcohol: string | null
    tabaco: string | null
    nivel_actividad_fisica: string | null
    deporte: string[] | null
    // sesion_entrenamiento: string[] | null,
    sesion_deportiva: {
        descripcion: string | null,
        disciplina: string | null,
        duracion: number | null,
        intensidad: string | null,
        tipo_evento: string | null, //entrenamiento o competencia
        dias: string | null,
        horario: string | null,
    }[] | null
}

export interface AnamnesisDto {
    objetivos: ObjetivosDto | null
    clinica: AnamnesisClinicaDto | null
    alimentaria: AnamnesisAlimentariaDto | null
    estilo_vida: EstiloVidaSaludableDto | null
}

export interface MedicionesDto {
    peso: number | null
    talla: number | null
    somatotipo: string | null
}

export interface ConsultaCompletaDto {
    informacion_personal: InformacionPersonalDto | null
    anamnesis: AnamnesisDto | null
    mediciones: MedicionesDto | null
}
