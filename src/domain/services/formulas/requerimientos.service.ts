const CONSTANTE_TERMOGENESIS = 1.1;

type TasaMetabolicaBasalType = {
    peso: number
    talla: number
    sexo: string
    edad: number
    deportista: boolean
    somatotipo: string
}

type GastoEnergeticoTotalType = {
    peso: number
    talla: number
    sexo: string
    edad: number
    nivel_actividad_fisica: number
    deportista: boolean
    somatotipo: string
}

type RequerimientosType = {
    peso: number
    talla: number
    sexo: string
    edad: number
    nivel_actividad_fisica: number
    objetivo: string
    deportista: boolean
    somatotipo: string
}

export interface Requerimientos {
    energia: number
    proteina: number
    carbohidrato: number
    lipido: number
}

//helper function - calcula tmb con formula de Mifflin-St Jeor (1990)
export function tasaMetabolicaBasalMifflin(peso: number, talla: number, edad: number, sexo: string): number{
    //sexo
    sexo = sexo[0].toUpperCase();
    //talla
    if(talla < 10){
        talla = talla * 100;
    }
    //tmb calculo
    if(sexo === 'M'){
        return (10*peso) + (6.25*talla) - (5*edad) + 5;
    }else{
        return (10*peso) + (6.25*talla) - (5*edad) - 161;
    }
}

export function calcImc(peso: number, talla: number){
    if(talla < 10){
        talla = talla * 100;
    }
    const imc = peso / ((talla/100)*(talla/100))
    return imc;
}

//helper function - calcula tmb con formula de Carrasco (2002)
export function tasaMetabolicaBasalCarrasco(peso: number, talla: number, sexo: string): number{
    //sexo
    sexo = sexo[0].toUpperCase();
    //talla
    if(talla < 10){
        talla = talla * 100;
    }
    //imc
    const imc = calcImc(peso, talla)
    //tmb calculo
    if(sexo === 'M'){
        if(imc < 25){
            return peso * 23.6;
        }else if(imc < 30){
            return peso * 20;
        }else if(imc < 40){
            return peso * 19;
        }else{
            return peso * 17;
        }
    }else{
        if(imc < 25){
            return peso * 20.7;
        }else if(imc < 30){
            return peso * 19.7;
        }else if(imc < 40){
            return peso * 18.3;
        }else{
            return peso * 16.2;
        }
    }
}

//helper function - calcula tmb
export function tasaMetabolicaBasal({peso, talla, sexo, edad, deportista, somatotipo }: TasaMetabolicaBasalType): number{
    //convertir talla a cm
    if(talla < 10){
        talla = talla * 100;
    }
    //sexo
    sexo = sexo[0].toUpperCase();
    //imc
    const imc = calcImc(peso, talla);
    //tmb inicial
    let tmb = 0;
    //tmb calculo
    if(edad > 18){ //>18
        if(deportista){ //deportista
            if(imc < 25){ //NP
                tmb = tasaMetabolicaBasalMifflin(peso, talla, edad, sexo);
            }else{ //SP u OB
                if(somatotipo == 'MESO' || somatotipo == 'MESOECTO'){
                    tmb = tasaMetabolicaBasalMifflin(peso, talla, edad, sexo);
                }else if(somatotipo == 'MESOENDO'){ 
                    tmb = (tasaMetabolicaBasalCarrasco(peso, talla, sexo) + tasaMetabolicaBasalMifflin(peso, talla, edad, sexo))/2;
                }else{
                    tmb = tasaMetabolicaBasalCarrasco(peso, talla, sexo);
                }
            }
        }else{ //no es deportista (o por hobby) 
            tmb = tasaMetabolicaBasalCarrasco(peso, talla, sexo);
        }
    }else{ // <18 - FAO/OMS/UNU (1985) 
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

//helper function - calcula get
export function gastoEnergeticoTotal({peso, talla, sexo, edad, nivel_actividad_fisica, deportista, somatotipo}: GastoEnergeticoTotalType): number{
    const tmb = tasaMetabolicaBasal({peso, talla, sexo, edad, deportista, somatotipo});
    const get = tmb * (1 + (nivel_actividad_fisica -1) + (CONSTANTE_TERMOGENESIS -1));
    return Math.round(get);
}

//calcula req - contempla definit/superavit
export function calculoRequerimientos({peso, talla, sexo, edad, nivel_actividad_fisica, objetivo, deportista, somatotipo}: RequerimientosType): Requerimientos {

    const get = gastoEnergeticoTotal({ peso, talla, sexo, edad, nivel_actividad_fisica, deportista, somatotipo});

    if(talla < 10){
        talla = talla * 100;
    }

    const imc = calcImc(peso, talla);

    const energia = () => {
        if (objetivo == 'definicion'){
            if(imc < 30){
                return get - 500;
            }else if(imc < 35){
                return get - 750;
            }else{
                return get - 1000;
            }
        } else if (objetivo == 'volumen'){
            let superavit = ((peso * 0.015 ) * 7000 ) / 30
            return get + superavit
        } else {
            return get
        }
    }

    const proteina = () => {
        if(imc < 25){
            return peso * 1.6;
        }else if(somatotipo == 'ECTO' || somatotipo == 'MESOECTO' || somatotipo == 'MESO'){
            return peso * 1.6; //peso real
        }else if(somatotipo == 'MESOENDO'){
            const pesoReajustado = 25 * ((talla/100)*(talla/100)); 
            return pesoReajustado * 1.6; //reajuste con imc 25
        }else{
            const pesoReajustado = 23.5 * ((talla/100)*(talla/100)); 
            return pesoReajustado * 1.6; //reajuste con imc 23.5
        }
    }

    const carbohidrato = () => {
        let cho = 0;
        let choGrPorKg = 0;
        if (objetivo == 'definicion'){
            cho = (energia() * 0.55)/4;
            choGrPorKg = cho/peso;
            if(cho/peso >= 3){
                return cho;
            }else{
                cho = peso * 3;
                return cho;
            }
        } else if (objetivo == 'volumen'){
            cho = ((energia() * 0.5)/4) ;
            choGrPorKg = cho/peso;
            if(cho/peso <= 5){
                return cho;
            }else{
                cho = peso * 5;
                return cho;
            }
        } else {
            return ((energia() * 0.5)/4) ;
        }
    }

    const lipido = () => {
        return ((energia() - (carbohidrato() * 4) - (proteina() * 4))/9)
    }

    const requerimientos = {
        energia: energia(),
        proteina: proteina(),
        carbohidrato: carbohidrato(),
        lipido: lipido(),
    }

    return requerimientos;

}
