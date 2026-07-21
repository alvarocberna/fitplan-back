
// openai compara los campos de 'sesion_entrenamiento' con los objetos de sesiones_deportivas y extrae el 
// codigo de la sesión que más coincida
export const SESIONES_DEPORTIVAS = {
    entrenamiento: [
        {
            codigo: '001',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de pesas, gimnasio o circuitos, intensidad media-alta, corta duración',
            disciplina: 'gimnasio',
            duracion: 'menos de 60 minutos',
            intensidad: 'media-alta',
        },
        {
            codigo: '002',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de pesas, gimnasio o circuitos, intensidad media-alta, media duración',
            disciplina: 'gimnasio',
            duracion: '60-119 minutos',
            intensidad: 'media-alta',
        },
        {
            codigo: '003',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de pesas, gimnasio o circuitos, intensidad media-alta, larga duración',
            disciplina: 'gimnasio',
            duracion: '120 minutos o más',
            intensidad: 'media-alta',
        },
        {
            codigo: '004',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, corta duración',
            disciplina: 'correr, running, nadar o remar',
            duracion: 'menos de 45 minutos',
            intensidad: 'media',
        },
        {
            codigo: '005',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, media-corta duración',
            disciplina: 'correr, running, nadar o remar',
            duracion: '45-59 minutos',
            intensidad: 'media',
        },
        {
            codigo: '006',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, media duración',
            disciplina: 'correr, running, nadar o remar',
            duracion: '60-89 minutos',
            intensidad: 'media',
        },
        {
            codigo: '007',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, media duración',
            disciplina: 'correr, running, nadar o remar',
            duracion: '90-119 minutos',
            intensidad: 'media',
        },
        {
            codigo: '008',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, larga duración',
            disciplina: 'correr, running, nadar o remar',
            duracion: '120 minutos o más',
            intensidad: 'media',
        },
        {
            codigo: '009',
            tipo: 'entrenamiento',
            descripcion: 'entrenamiento de deportes en equipo, como entrenamiento en cancha o partido de futbol, hockey, rugby, basquetball, etc. Intensidad moderada con sprints de alta intensidad de vez en cuando, duración 60-90 minutos',
            disciplina: 'correr, running, nadar o remar',
            duracion: '60-90 minutos',
            intensidad: 'media',
        },
    ],
    competencia: [
        {
            codigo: '010',
            tipo: 'competencia',
            descripcion: 'partidos competitivos en deportes como futbol hocket, basquetball o rugby',
            disciplina: 'deportes de equipo como futbol, hockey, basquetball, rugby',
            duracion: '60-90 minutos',
            intensidad: 'media-alta',
        },
        {
            codigo: '011',
            tipo: 'competencia',
            descripcion: 'partidos competitivos en deportes individuales de raqueta como tenis',
            disciplina: 'deportes individuales de raqueta como tenis',
            duracion: '90-120 minutos',
            intensidad: 'media-alta',
        },
        {
            codigo: '012',
            tipo: 'competencia',
            descripcion: 'competencia en disciplinas de muy corta duración y muy alta intensidad como 100 y 200 metros planos o levantamiento de pesas',
            disciplina: 'atletismo 100 y 200 metros planos, 110 metros vallas, levantamiento de pesas, halterofilia',
            duracion: 'menos de 30 segundos',
            intensidad: 'muy alta',
        },
        {
            codigo: '013',
            tipo: 'competencia',
            descripcion: 'competencia en disciplinas de corta duración y alta intensidad como 400 y 800 metros planos',
            disciplina: 'atletismo 400 y 800 metros planos',
            duracion: '40-150 segundos',
            intensidad: 'alta',
        },
        {
            codigo: '014',
            tipo: 'competencia',
            descripcion: 'competencia en disciplinas de media duración y media-alta intensidad como 1500 y 3000 metros, o remo 2000 metros',
            disciplina: 'atletismo 1500 y 3000 metros, remo 1000 y 2000 metros',
            duracion: '3-12 minutos',
            intensidad: 'media-alta',
        },
        {
            codigo: '015',
            tipo: 'competencia',
            descripcion: 'competencia en disciplinas de media duración y mediana intensidad como 5K y 10K, natación 1500 0 3000 metros',
            disciplina: 'running 5K y 10K, natación 1500 y 3000 metros',
            duracion: '20-60 minutos',
            intensidad: 'media',
        },
        {
            codigo: '016',
            tipo: 'competencia',
            descripcion: 'competencia en disciplinas de larga duración y media-baja intensidad como 21K y 42K, o ntacion 5000-15000 metros',
            disciplina: 'running 21K y 42K, natación 5000-15000 metros',
            duracion: '1-3 horas',
            intensidad: 'media-baja',
        },
    ]
}

//se ingresa el código de la sesion deportiva elegica y la función devuelve recomendaciones 
export function recomendacionSesionDeportiva(codigo: string, duracion: number){
    
    //la duracion se redondea cada 30 unidades al valor más cercano y se convierte a horas
    const duracionAprox = () => {
        return (Math.round(duracion / 30) * 30) / 60;
    }

    //el aporte de hdec por hora se redondea hacia abajo
    const grChoPorHora = () => {
        if(duracion <90) {
            return 30;
        }else if(duracion < 119){
            return 45;
        }else if(duracion >= 120){
            return 60;
        }else{
            return 30;
        }
    }

    const aporteChoTotal = duracionAprox() * grChoPorHora();

    const comidaResistencia = () => {
        if(aporteChoTotal == 30){
            return '1 gel deportivo de 30gr o 1/2 litro de jugo isotónico'
        }else if(aporteChoTotal == 45){
            return '1 gel deportivo de 50gr o 3/4 litro de jugo isotónico'
        }else if(aporteChoTotal == 67.5){
            return '1 gel deportivo de 50gr o 1 litro de jugo isotónico'
        }else if(aporteChoTotal == 90){
            return '1 litro de jugo isotonico + 1 gel deportivo de 30gr'
        }else if(aporteChoTotal == 120){
            return '1 litro de jugo isotonico + 1 gel deportivo de 50gr'
        }
    }


    let indicacion001 = {
        sesion: '',
        estrategia: 'Mantener una hidratación adecuada para favorecer el rendimiento y la función muscular durante el entrenamiento.',
        pre_actividad: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        durante_actividad: 'Acompañar entrenamiento con 500ml de agua o jugo isotonico light en caso de ambientes calurosos o sufrir de sudoración excesiva.',
        post_actividad: null,
    }

    let indicacion002 = {
        sesion: '',
        estrategia: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        pre_actividad: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        durante_actividad: 'Acompañar entrenamiento con 1/2 litro de jugo isotónico.',
        post_actividad: null,
    }

    let indicacion003 = {
        sesion: '',
        estrategia: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        pre_actividad: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        durante_actividad: 'Acompañar entrenamiento con 1 litro de jugo isotónico.',
        post_actividad: null,
    }

    let indicacion005 = {
        sesion: '',
        estrategia: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        pre_actividad: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        durante_actividad: 'Acompañar entrenamiento con 20-30gr de carbohidratos, como 1 gel deportivo de 30gr o 1/2 litro de jugo isotónico.',
        post_actividad: null,
    }
    let indicacion006 = {
        sesion: '',
        estrategia: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        pre_actividad: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        durante_actividad: `Acompañar entrenamiento con ${grChoPorHora()}gr de carbohidratos/hora. Equivalente a ${comidaResistencia()}. Ingerir
        alimento a partir de los 15 minutos de actividad y distribuir a lo largo del entrenamiento.`,
        post_actividad: null,
    }


    switch (codigo) {
        case '001':
            // console.log(indicacion001)
            return indicacion001;

        case '002':
            // console.log(indicacion002)
            return indicacion002;

        case '003':
            // console.log(indicacion003)
            return indicacion003;

        case '004':
            // console.log(indicacion001)
            return indicacion001;

        case '005':
            // console.log(indicacion005)
            return indicacion005;
        
        case '006':
            // console.log(indicacion006)
            return indicacion006;

        case '007':
            // console.log(indicacion006)
            return indicacion006;

        case '008':
            // console.log(indicacion006)
            return indicacion006;

        case '009':
            // console.log(indicacion006)
            return indicacion006;

        default:
            // console.log('default' + indicacion001)
            return indicacion001;
    }

}
