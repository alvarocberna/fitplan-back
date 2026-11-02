// JSON Schema acotado para describir la respuesta que se le exige al modelo de lenguaje ("structured
// output"), y un validador propio para comprobarla en el backend. Es un tipo neutro: no depende del SDK
// de ningún proveedor.
//
// Solo se admite el subconjunto que aceptan los proveedores en modo estricto:
//  - object: todas sus propiedades son obligatorias y no se permiten propiedades adicionales;
//  - un campo "opcional" se expresa como unión con null (type: ['string', 'null']);
//  - enum para valores cerrados.

export type JsonSchemaPrimitiveType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null';
export type JsonSchemaType = JsonSchemaPrimitiveType | 'object' | 'array';

export interface JsonSchema {
  // un tipo, o una unión de tipos (típicamente [tipo, 'null'])
  type: JsonSchemaType | JsonSchemaType[];
  description?: string;
  // valores permitidos (para string / number)
  enum?: readonly (string | number | null)[];
  // object
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: false;
  // array
  items?: JsonSchema;
}

// Esquema con nombre, tal como se le entrega al proveedor.
export interface NamedJsonSchema {
  // identificador del esquema: letras, números, guion y guion bajo
  name: string;
  schema: JsonSchema;
}

function typeOf(value: unknown): JsonSchemaType | 'undefined' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'number':
      return Number.isFinite(value) ? 'number' : 'undefined';
    case 'object':
      return 'object';
    default:
      return 'undefined';
  }
}

function matchesType(value: unknown, type: JsonSchemaType): boolean {
  const actual = typeOf(value);
  if (type === 'integer') return actual === 'number' && Number.isInteger(value);
  return actual === type;
}

// Valida `value` contra `schema` y devuelve la lista de errores, cada uno con la ruta del dato
// (ej. "mealTimes[2].examples[0].components[1].weight: se esperaba number, llegó string").
// Lista vacía = cumple.
export function validateJsonSchema(
  value: unknown,
  schema: JsonSchema,
  path = '$',
): string[] {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const matched = types.find((type) => matchesType(value, type));
  if (!matched) {
    return [
      `${path}: se esperaba ${types.join(' | ')}, llegó ${typeOf(value)}`,
    ];
  }

  if (schema.enum && !schema.enum.includes(value as string | number | null)) {
    return [
      `${path}: valor ${JSON.stringify(value)} fuera de los permitidos (${schema.enum.join(', ')})`,
    ];
  }

  if (matched === 'object') {
    const object = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    const errors: string[] = [];
    for (const key of schema.required ?? []) {
      if (!(key in object)) errors.push(`${path}.${key}: falta el campo`);
    }
    for (const [key, child] of Object.entries(object)) {
      const childSchema = properties[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) {
          errors.push(`${path}.${key}: campo no permitido`);
        }
        continue;
      }
      errors.push(...validateJsonSchema(child, childSchema, `${path}.${key}`));
    }
    return errors;
  }

  if (matched === 'array' && schema.items) {
    const items = schema.items;
    return (value as unknown[]).flatMap((item, index) =>
      validateJsonSchema(item, items, `${path}[${index}]`),
    );
  }

  return [];
}

// Reglas del modo estricto de los proveedores: todo objeto declara TODAS sus propiedades como
// obligatorias y prohíbe las adicionales, y todo arreglo declara el tipo de sus elementos. Devuelve
// los incumplimientos (vacío = el esquema es estricto). Se usa en los tests de cada esquema.
export function strictSchemaViolations(
  schema: JsonSchema,
  path = '$',
): string[] {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const errors: string[] = [];

  if (types.includes('object')) {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    if (schema.additionalProperties !== false) {
      errors.push(`${path}: falta additionalProperties: false`);
    }
    for (const key of Object.keys(properties)) {
      if (!required.has(key))
        errors.push(`${path}.${key}: no está en "required"`);
      errors.push(...strictSchemaViolations(properties[key], `${path}.${key}`));
    }
    for (const key of required) {
      if (!(key in properties))
        errors.push(
          `${path}.${key}: está en "required" pero no en "properties"`,
        );
    }
  }

  if (types.includes('array')) {
    if (!schema.items) errors.push(`${path}: falta "items"`);
    else errors.push(...strictSchemaViolations(schema.items, `${path}[]`));
  }

  return errors;
}

// Atajo para un objeto estricto: todas las propiedades obligatorias, sin adicionales.
export function strictObject(
  properties: Record<string, JsonSchema>,
  description?: string,
): JsonSchema {
  return {
    type: 'object',
    ...(description && { description }),
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
