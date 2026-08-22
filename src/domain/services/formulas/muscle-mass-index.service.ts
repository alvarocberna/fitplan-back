import { EvaClassification } from './classifications.enum';

type MuscleMassIndexType = {
    weight: number
    height: number
    fatMassKg: number
}

type MuscleMassIndexClassificationType = {
    muscleMassIndex: number
    gender: string
}

export function calculateMuscleMassIndex({weight, height, fatMassKg}: MuscleMassIndexType): number{
    weight = weight - fatMassKg;
    if(height <10){
        height = height * 100
    }
    const muscleMassIndex = ( weight / ((height/100)**2) ) + (6.3 * (1.8 - (height/100)))
    return muscleMassIndex;
}

export function getMuscleMassIndexClassification({muscleMassIndex, gender}: MuscleMassIndexClassificationType): EvaClassification{
    gender = gender[0].toUpperCase();
    let classification: EvaClassification = EvaClassification.MEDIUM;
    if(gender === 'M'){
        switch(true){
            case muscleMassIndex < 19:
                classification = EvaClassification.LOW;;
                break;
            case muscleMassIndex >= 19 && muscleMassIndex < 21:
                classification = EvaClassification.MEDIUM;
                break;
            case muscleMassIndex >= 21 && muscleMassIndex < 23:
                classification = EvaClassification.HIGH;
                break;
            case muscleMassIndex >= 23:
                classification = EvaClassification.VERY_HIGH;
                break;
        }
    }else if(gender === 'F'){
        switch(true){
            case muscleMassIndex < 15:
                classification = EvaClassification.LOW;;
                break;
            case muscleMassIndex >= 15 && muscleMassIndex < 17:
                classification = EvaClassification.MEDIUM;
                break;
            case muscleMassIndex >= 17 && muscleMassIndex < 19:
                classification = EvaClassification.HIGH;
                break;
            case muscleMassIndex >= 19:
                classification = EvaClassification.VERY_HIGH;
                break;
        }
    }
    return classification;
}