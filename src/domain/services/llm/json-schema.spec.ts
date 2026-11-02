import {
  JsonSchema,
  strictObject,
  strictSchemaViolations,
  validateJsonSchema,
} from './json-schema';

describe('validateJsonSchema', () => {
  const schema: JsonSchema = strictObject({
    name: { type: 'string' },
    age: { type: 'integer' },
    weight: { type: 'number' },
    active: { type: 'boolean' },
    nickname: { type: ['string', 'null'] },
    goal: { type: 'string', enum: ['definicion', 'mantencion', 'volumen'] },
    tags: { type: 'array', items: { type: 'string' } },
    address: strictObject({ city: { type: 'string' } }),
  });

  const valid = {
    name: 'Ana',
    age: 30,
    weight: 62.5,
    active: true,
    nickname: null,
    goal: 'volumen',
    tags: ['a', 'b'],
    address: { city: 'Santiago' },
  };

  it('un valor que cumple no produce errores', () => {
    expect(validateJsonSchema(valid, schema)).toEqual([]);
  });

  it('informa el tipo equivocado con la ruta del dato', () => {
    expect(validateJsonSchema({ ...valid, weight: '62' }, schema)).toEqual([
      '$.weight: se esperaba number, llegó string',
    ]);
  });

  it('un decimal no es un integer', () => {
    expect(validateJsonSchema({ ...valid, age: 30.5 }, schema)).toEqual([
      '$.age: se esperaba integer, llegó number',
    ]);
  });

  it('NaN e Infinity no son números válidos', () => {
    expect(validateJsonSchema({ ...valid, weight: NaN }, schema)).toHaveLength(
      1,
    );
    expect(
      validateJsonSchema({ ...valid, weight: Infinity }, schema),
    ).toHaveLength(1);
  });

  it('una unión con null acepta el valor y null, pero no otro tipo', () => {
    expect(validateJsonSchema({ ...valid, nickname: 'Anita' }, schema)).toEqual(
      [],
    );
    expect(validateJsonSchema({ ...valid, nickname: 5 }, schema)).toEqual([
      '$.nickname: se esperaba string | null, llegó number',
    ]);
  });

  it('rechaza un valor fuera del enum', () => {
    expect(validateJsonSchema({ ...valid, goal: 'otra cosa' }, schema)).toEqual(
      [
        '$.goal: valor "otra cosa" fuera de los permitidos (definicion, mantencion, volumen)',
      ],
    );
  });

  it('un enum numérico compara por valor', () => {
    const level: JsonSchema = { type: 'number', enum: [1.4, 1.5, 1.6] };
    expect(validateJsonSchema(1.5, level)).toEqual([]);
    expect(validateJsonSchema(1.2, level)).toHaveLength(1);
  });

  it('informa los campos que faltan y los que sobran', () => {
    const { name: _name, ...withoutName } = valid;
    expect(validateJsonSchema({ ...withoutName, extra: 1 }, schema)).toEqual([
      '$.name: falta el campo',
      '$.extra: campo no permitido',
    ]);
  });

  it('valida cada elemento de un arreglo y los objetos anidados, con su ruta', () => {
    expect(
      validateJsonSchema(
        { ...valid, tags: ['a', 2], address: { city: null } },
        schema,
      ),
    ).toEqual([
      '$.tags[1]: se esperaba string, llegó number',
      '$.address.city: se esperaba string, llegó null',
    ]);
  });

  it('junta todos los errores en vez de cortar en el primero', () => {
    expect(validateJsonSchema({}, schema)).toHaveLength(8);
  });

  it('un arreglo no es un objeto, ni null', () => {
    expect(validateJsonSchema([], schema)).toEqual([
      '$: se esperaba object, llegó array',
    ]);
    expect(validateJsonSchema(null, schema)).toEqual([
      '$: se esperaba object, llegó null',
    ]);
  });
});

describe('strictSchemaViolations', () => {
  it('un esquema armado con strictObject es estricto', () => {
    const schema = strictObject({
      list: { type: 'array', items: strictObject({ a: { type: 'string' } }) },
    });
    expect(strictSchemaViolations(schema)).toEqual([]);
  });

  it('detecta propiedades fuera de "required", objetos abiertos y arreglos sin "items"', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        list: { type: 'array' },
        nested: {
          type: ['object', 'null'],
          properties: { b: { type: 'string' } },
          required: ['b'],
        },
      },
      required: ['a', 'list', 'ghost'],
    };

    expect(strictSchemaViolations(schema)).toEqual([
      '$: falta additionalProperties: false',
      '$.list: falta "items"',
      '$.nested: no está en "required"',
      '$.nested: falta additionalProperties: false',
      '$.ghost: está en "required" pero no en "properties"',
    ]);
  });
});
