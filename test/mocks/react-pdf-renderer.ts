// Stub de Jest para '@react-pdf/renderer' (ver moduleNameMapper en package.json y
// test/jest-e2e.json). El paquete real solo se publica como ESM puro (además de arrastrar
// varias dependencias internas también ESM), lo que Jest+ts-jest no puede transformar tal
// cual. Como los tests nunca necesitan un PDF real (solo verifican que PdfService/EmailService
// invoquen renderToBuffer con el documento correcto y usen el Buffer resultante), esto
// reemplaza el paquete completo por componentes inertes + un renderToBuffer mockeado.
const Noop = (props: { children?: unknown }) => props.children ?? null;

export const Document = Noop;
export const Page = Noop;
export const Text = Noop;
export const View = Noop;
export const Image = Noop;
export const Svg = Noop;
export const Polygon = Noop;
export const Circle = Noop;
export const Path = Noop;
export const Rect = Noop;
export const Line = Noop;
export const G = Noop;
export const Defs = Noop;
export const LinearGradient = Noop;
export const Stop = Noop;

export const Font = { register: () => {} };
export const StyleSheet = { create: (styles: unknown) => styles };

export const renderToBuffer = jest.fn().mockResolvedValue(Buffer.from(''));
