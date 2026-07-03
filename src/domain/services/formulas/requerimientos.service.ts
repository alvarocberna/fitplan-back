const CONSTANTE_TERMOGENESIS = 1.1;

type TasaMetabolicaBasalType = {
    peso: number
    talla: number
    sexo: string
    edad: number
}

type GastoEnergeticoTotalType = {
    peso: number
    talla: number
    sexo: string
    edad: number
    nivel_actividad_fisica: number
}

type RequerimientosType = {
    peso: number
    talla: number
    sexo: string
    edad: number
    nivel_actividad_fisica: number
    objetivo: string
}

export interface Requerimientos {
    energia: number
    proteina: number
    carbohidrato: number
    lipido: number
}

export function tasaMetabolicaBasal({peso, talla, sexo, edad}: TasaMetabolicaBasalType): number{
    //sexo
    sexo = sexo[0].toUpperCase();
    //convertir talla a cm
    if(talla < 10){
        talla = talla * 100;
    }
    //tmb inicial
    let tmb = 0;
    //tmb calculo
    if(edad > 18){
        // Harris-Benedict (1919)
        if(sexo === 'M'){
            tmb = 66.5 + (13.75*peso) + (5.003*talla) - (6.775*edad); 
        }else if(sexo === 'F'){
            tmb = 655.1 + (9.563*peso) + (1.85*talla) - (4.676*edad);
        }
    }else{
        // FAO/OMS/UNU (1985)
        if(sexo === 'M'){
            switch(true){
                case edad < 10:
                    tmb = (22.706*peso) + 504.3;
                    break;
                default:
                    tmb = (17.686*peso) + 658.2;
                    break;
            }
        }else if(sexo === 'F'){
            switch(true){
                case edad < 10:
                    tmb = (22.315*peso) + 485.9;
                    break;
                default:
                    tmb = (13.384*peso) + 692.6;
                    break;
            }
        }
    }
    return tmb;
}

export function gastoEnergeticoTotal({peso, talla, sexo, edad, nivel_actividad_fisica}: GastoEnergeticoTotalType): number{
    const tmb = tasaMetabolicaBasal({peso, talla, sexo, edad});
    const get = tmb * (1 + (nivel_actividad_fisica -1) + (CONSTANTE_TERMOGENESIS -1));
    return Math.round(get);
}

export function calculoRequerimientos({peso, talla, sexo, edad, nivel_actividad_fisica, objetivo}: RequerimientosType): Requerimientos {

    const get = gastoEnergeticoTotal({ peso, talla, sexo, edad, nivel_actividad_fisica});

    const energia = () => {
        if (objetivo == 'definicion'){
            return get - 500;
        } else if (objetivo == 'volumen'){
            return get + 200
        } else {
            return get
        }
    }
    const proteina = peso * 1.5;

    const carbohidrato = () => {
        if (objetivo == 'definicion'){
            return ((energia() * 0.5)/4) ;
        } else if (objetivo == 'volumen'){
            return ((energia() * 0.55)/4) ;
        } else {
            return ((energia() * 0.55)/4) ;
        }
    }

    const lipido = () => {
        return ((energia() - (carbohidrato() * 4) - (proteina * 4))/9)
    }

    const requerimientos = {
        energia: energia(),
        proteina: proteina,
        carbohidrato: carbohidrato(),
        lipido: lipido(),
    }

    return requerimientos;

}