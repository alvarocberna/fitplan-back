import {
  buildPredefinedPlanCode,
  isPredefinedPlanCode,
  listPredefinedPlanSelections,
  PREDEFINED_PLAN_CODE_REGEX,
} from './predefined-plan-code';

describe('predefined-plan-code', () => {
  it('buildPredefinedPlanCode arma el código <plan>-<pesoMin>-<pesoMax>-<sexo>-<edad>', () => {
    expect(
      buildPredefinedPlanCode({
        family: 'plan-gimnasio-volumen',
        weightRange: '50-60',
        sex: 'm',
        ageGroup: 'joven',
      }),
    ).toBe('plan-gimnasio-volumen-50-60-m-joven');
    expect(
      buildPredefinedPlanCode({
        family: 'plan-gimnasio-definicion',
        weightRange: '70-80',
        sex: 'f',
        ageGroup: 'adulto',
      }),
    ).toBe('plan-gimnasio-definicion-70-80-f-adulto');
  });

  it('acepta planes con guiones en el nombre y el rango 100-120', () => {
    expect(isPredefinedPlanCode('plan-deporte-cancha-100-120-m-adulto')).toBe(true);
    expect(isPredefinedPlanCode('plan-gimnasio-definicion-40-50-f-joven')).toBe(true);
    expect(isPredefinedPlanCode('plan-running-90-100-f-adulto')).toBe(true);
  });

  it.each([
    'plan-futbol-50-60-m-joven', // plan inexistente
    'plan-gimnasio-volumen-55-65-m-joven', // rango de peso inexistente
    'plan-gimnasio-volumen-50-60-x-joven', // sexo inválido
    'plan-gimnasio-volumen-50-60-m-viejo', // grupo de edad inválido
    'PLAN-GIMNASIO-VOLUMEN-50-60-M-JOVEN', // mayúsculas
    'plan-gimnasio-volumen-50-60-m-joven ', // espacio final
    'plan-gimnasio-volumen-50-60-m-joven/../x', // intento de path traversal
    '',
  ])('rechaza el código inválido %p', (code) => {
    expect(isPredefinedPlanCode(code)).toBe(false);
  });

  it('rechaza valores que no son string', () => {
    expect(isPredefinedPlanCode(undefined)).toBe(false);
    expect(isPredefinedPlanCode(123)).toBe(false);
  });

  it('listPredefinedPlanSelections genera las 112 versiones, todas distintas y válidas', () => {
    const codes = listPredefinedPlanSelections().map(buildPredefinedPlanCode);

    expect(codes).toHaveLength(112);
    expect(new Set(codes).size).toBe(112);
    expect(codes.every((code) => PREDEFINED_PLAN_CODE_REGEX.test(code))).toBe(true);
  });
});
