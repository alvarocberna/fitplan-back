//PASO 2 DOC
export function buildPrescripcionPrompt(objetivo: string): string {
  return `
### Prescripción

Completa "regimen" y "objetivo" siguiendo EXACTAMENTE estas reglas (son reglas fijas, no las
reinterpretes con tu propio criterio):

**Campo "objetivo"**: una descripción breve, en lenguaje natural, del objetivo del paciente, construida
en base a los campos "objetivos.objetivo_principal" y "objetivos.objetivo_secundario" de la sección
"Datos de la consulta". Ejemplos de formato esperado (no copies el contenido, solo el estilo):
"Disminuir porcentaje de grasa corporal y mantener masa muscular", "Aumentar masa muscular",
"Mejorar rendimiento deportivo", "Mejorar rendimiento deportivo y ganar masa muscular y fuerza".

**Campo "regimen"**: sigue EXACTAMENTE el formato "Régimen {prescripción calórica} {prescripción proteica}."
- Prescripción calórica: la clasificación interna de objetivo de este paciente, ya determinada por el
  sistema, es "${objetivo}". Si es "definicion" usa "hipocalórico"; si es "volumen" usa "hipercalórico";
  si es "mantencion" usa "normocalórico". Esta clasificación interna es solo para construir esta
  palabra: NUNCA debe aparecer literalmente (ej "volumen" o "definicion") en el campo "objetivo".
- Prescripción proteica: usa SIEMPRE "hiperproteico" (el sistema siempre prescribe 1.6gr/kg de peso o
  más de proteína, lo que corresponde siempre a la categoría hiperproteico).
- Ejemplos completos: "Régimen hipocalórico hiperproteico.", "Régimen hipercalórico hiperproteico.",
  "Régimen normocalórico hiperproteico."
`;
}
