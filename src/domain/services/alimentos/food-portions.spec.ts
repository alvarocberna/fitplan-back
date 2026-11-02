import { FOOD_FIELD_TO_GROUP, findFoodGroup } from './food-portions';

describe('findFoodGroup', () => {
  it('encuentra un grupo sin subcategoría', () => {
    const group = findFoodGroup('Cereales', null);
    expect(group.group).toBe('Cereales');
    expect(group.intakePerPortion).toEqual({
      calories: 140,
      protein: 3,
      carbohydrate: 30,
      fat: 1,
    });
  });

  it('encuentra un grupo con subcategoría', () => {
    const group = findFoodGroup('Proteinas', 'Baja en grasa');
    expect(group.subcategory).toBe('Baja en grasa');
    expect(group.foods.some((f) => f.food === 'Pollo')).toBe(true);
  });

  it('lanza si el grupo/subcategoría no existe', () => {
    expect(() => findFoodGroup('Grupo inexistente', null)).toThrow(
      'Grupo de alimentos no encontrado: Grupo inexistente/null',
    );
  });

  it('lanza si la subcategoría no corresponde a ese grupo', () => {
    expect(() =>
      findFoodGroup('Cereales', 'Subcategoría inexistente'),
    ).toThrow();
  });
});

describe('FOOD_FIELD_TO_GROUP', () => {
  it('cada entrada mapea a un grupo/subcategoría que existe realmente en FOOD_GROUP_PORTIONS', () => {
    for (const [field, { group, subcategory }] of Object.entries(
      FOOD_FIELD_TO_GROUP,
    )) {
      expect(() => findFoodGroup(group, subcategory)).not.toThrow();
      expect(field).toBeTruthy();
    }
  });
});
