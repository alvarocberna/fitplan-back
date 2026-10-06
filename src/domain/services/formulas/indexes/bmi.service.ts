import { BmiClassification } from '../classifications.enum';

type BmiType = {
    weight: number
    height: number
}


export function calculateBmi({weight, height}: BmiType): number{
    if(height <10){
        height = height * 100
    }
    const bmi = weight / ((height/100)**2)
    return bmi;
}

export function getBmiClassification(bmi: number): BmiClassification{
    let classification: BmiClassification = BmiClassification.NORMAL_WEIGHT;
    switch(true){
        case bmi < 18.5:
            classification = BmiClassification.UNDERWEIGHT;;
            break;
        case bmi >= 18.5 && bmi < 25:
            classification = BmiClassification.NORMAL_WEIGHT;
            break;
        case bmi >= 25 && bmi < 30:
            classification = BmiClassification.OVERWEIGHT;
            break;
        case bmi >= 30 && bmi < 35:
            classification = BmiClassification.OBESITY_I;
            break;
        case bmi >= 35 && bmi < 40:
            classification = BmiClassification.OBESITY_II;
            break;
        case bmi >= 40:
            classification = BmiClassification.OBESITY_III;
            break;
        }
    return classification;
}