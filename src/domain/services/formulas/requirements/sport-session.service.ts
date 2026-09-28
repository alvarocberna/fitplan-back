
// openai compara los campos de 'sessionTraining' con los objetos de sportSessions y extrae el
// codigo de la sesión que más coincida
export const SPORT_SESSIONS = {
    entrenamiento: [
        {
            code: '001',
            type: 'entrenamiento',
            description: 'entrenamiento de pesas, gimnasio o circuitos, intensidad media-alta, corta duración',
            discipline: 'gimnasio',
            duration: 'menos de 60 minutos',
            intensity: 'media-alta',
        },
        {
            code: '002',
            type: 'entrenamiento',
            description: 'entrenamiento de pesas, gimnasio o circuitos, intensidad media-alta, media duración',
            discipline: 'gimnasio',
            duration: '60-119 minutos',
            intensity: 'media-alta',
        },
        {
            code: '003',
            type: 'entrenamiento',
            description: 'entrenamiento de pesas, gimnasio o circuitos, intensidad media-alta, larga duración',
            discipline: 'gimnasio',
            duration: '120 minutos o más',
            intensity: 'media-alta',
        },
        {
            code: '004',
            type: 'entrenamiento',
            description: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, corta duración',
            discipline: 'correr, running, nadar o remar',
            duration: 'menos de 45 minutos',
            intensity: 'media',
        },
        {
            code: '005',
            type: 'entrenamiento',
            description: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, media-corta duración',
            discipline: 'correr, running, nadar o remar',
            duration: '45-59 minutos',
            intensity: 'media',
        },
        {
            code: '006',
            type: 'entrenamiento',
            description: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, media duración',
            discipline: 'correr, running, nadar o remar',
            duration: '60-89 minutos',
            intensity: 'media',
        },
        {
            code: '007',
            type: 'entrenamiento',
            description: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, media duración',
            discipline: 'correr, running, nadar o remar',
            duration: '90-119 minutos',
            intensity: 'media',
        },
        {
            code: '008',
            type: 'entrenamiento',
            description: 'entrenamiento de resistencia como correr, nadar o remar, intensidad media, larga duración',
            discipline: 'correr, running, nadar o remar',
            duration: '120 minutos o más',
            intensity: 'media',
        },
        {
            code: '009',
            type: 'entrenamiento',
            description: 'entrenamiento de deportes en equipo, como entrenamiento en cancha o partido de futbol, hockey, rugby, basquetball, etc. Intensidad moderada con sprints de alta intensidad de vez en cuando, duración 60-90 minutos',
            discipline: 'correr, running, nadar o remar',
            duration: '60-90 minutos',
            intensity: 'media',
        },
    ],
    competencia: [
        {
            code: '010',
            type: 'competencia',
            description: 'partidos competitivos en deportes como futbol hocket, basquetball o rugby',
            discipline: 'deportes de equipo como futbol, hockey, basquetball, rugby',
            duration: '60-90 minutos',
            intensity: 'media-alta',
        },
        {
            code: '011',
            type: 'competencia',
            description: 'partidos competitivos en deportes individuales de raqueta como tenis',
            discipline: 'deportes individuales de raqueta como tenis',
            duration: '90-120 minutos',
            intensity: 'media-alta',
        },
        {
            code: '012',
            type: 'competencia',
            description: 'competencia en disciplinas de muy corta duración y muy alta intensidad como 100 y 200 metros planos o levantamiento de pesas',
            discipline: 'atletismo 100 y 200 metros planos, 110 metros vallas, levantamiento de pesas, halterofilia',
            duration: 'menos de 30 segundos',
            intensity: 'muy alta',
        },
        {
            code: '013',
            type: 'competencia',
            description: 'competencia en disciplinas de corta duración y alta intensidad como 400 y 800 metros planos',
            discipline: 'atletismo 400 y 800 metros planos',
            duration: '40-150 segundos',
            intensity: 'alta',
        },
        {
            code: '014',
            type: 'competencia',
            description: 'competencia en disciplinas de media duración y media-alta intensidad como 1500 y 3000 metros, o remo 2000 metros',
            discipline: 'atletismo 1500 y 3000 metros, remo 1000 y 2000 metros',
            duration: '3-12 minutos',
            intensity: 'media-alta',
        },
        {
            code: '015',
            type: 'competencia',
            description: 'competencia en disciplinas de media duración y mediana intensidad como 5K y 10K, natación 1500 0 3000 metros',
            discipline: 'running 5K y 10K, natación 1500 y 3000 metros',
            duration: '20-60 minutos',
            intensity: 'media',
        },
        {
            code: '016',
            type: 'competencia',
            description: 'competencia en disciplinas de larga duración y media-baja intensidad como 21K y 42K, o ntacion 5000-15000 metros',
            discipline: 'running 21K y 42K, natación 5000-15000 metros',
            duration: '1-3 horas',
            intensity: 'media-baja',
        },
    ]
}

//se ingresa el código de la sesion deportiva elegida y la función devuelve recomendaciones
export function getSportSessionRecommendation(code: string, duration: number){

    //la duracion se redondea cada 30 unidades al valor más cercano y se convierte a horas
    const approxDuration = () => {
        return (Math.round(duration / 30) * 30) / 60;
    }

    //el aporte de hdec por hora se redondea hacia abajo
    const carbGrPerHour = () => {
        if(duration <90) {
            return 30;
        }else if(duration < 119){
            return 45;
        }else if(duration >= 120){
            return 60;
        }else{
            return 30;
        }
    }

    const totalCarbIntake = approxDuration() * carbGrPerHour();

    const endurancemeal = () => {
        if(totalCarbIntake == 30){
            return '1 gel deportivo de 30gr o 1/2 litro de jugo isotónico'
        }else if(totalCarbIntake == 45){
            return '1 gel deportivo de 50gr o 3/4 litro de jugo isotónico'
        }else if(totalCarbIntake == 67.5){
            return '1 gel deportivo de 50gr o 1 litro de jugo isotónico'
        }else if(totalCarbIntake == 90){
            return '1 litro de jugo isotonico + 1 gel deportivo de 30gr'
        }else if(totalCarbIntake == 120){
            return '1 litro de jugo isotonico + 1 gel deportivo de 50gr'
        }
    }


    let indication001 = {
        session: '',
        strategy: 'Mantener una hidratación adecuada para favorecer el rendimiento y la función muscular durante el entrenamiento.',
        preActivity: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        duringActivity: 'Acompañar entrenamiento con 500ml de agua o jugo isotonico light en caso de ambientes calurosos o sufrir de sudoración excesiva.',
        postActivity: null,
    }

    let indication002 = {
        session: '',
        strategy: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        preActivity: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        duringActivity: 'Acompañar entrenamiento con 1/2 litro de jugo isotónico.',
        postActivity: null,
    }

    let indication003 = {
        session: '',
        strategy: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        preActivity: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        duringActivity: 'Acompañar entrenamiento con 1 litro de jugo isotónico.',
        postActivity: null,
    }

    let indication005 = {
        session: '',
        strategy: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        preActivity: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        duringActivity: 'Acompañar entrenamiento con 20-30gr de carbohidratos, como 1 gel deportivo de 30gr o 1/2 litro de jugo isotónico.',
        postActivity: null,
    }
    let indication006 = {
        session: '',
        strategy: 'Complementar suministro de energía durante el entrenamiento mediante carbohidratos exógenos para disminuir el consumo de reservas internas de glucógeno y mantener rendimiento.',
        preActivity: 'Ingerir 500ml de agua la hora previa a la sesión deportiva para iniciar el entrenamiento bien hidratados.',
        duringActivity: `Acompañar entrenamiento con ${carbGrPerHour()}gr de carbohidratos/hora. Equivalente a ${endurancemeal()}. Ingerir
        alimento a partir de los 15 minutos de actividad y distribuir a lo largo del entrenamiento.`,
        postActivity: null,
    }


    switch (code) {
        case '001':
            // console.log(indication001)
            return indication001;

        case '002':
            // console.log(indication002)
            return indication002;

        case '003':
            // console.log(indication003)
            return indication003;

        case '004':
            // console.log(indication001)
            return indication001;

        case '005':
            // console.log(indication005)
            return indication005;

        case '006':
            // console.log(indication006)
            return indication006;

        case '007':
            // console.log(indication006)
            return indication006;

        case '008':
            // console.log(indication006)
            return indication006;

        case '009':
            // console.log(indication006)
            return indication006;

        default:
            // console.log('default' + indication001)
            return indication001;
    }

}
