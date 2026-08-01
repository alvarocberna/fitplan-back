
# ENDPOINTS

## /anamnesis/chat (modulo anamnesis)
- Este endpoint se encarga se manejar el chat entre el user y openai para recopilar informacion
- Implememnta el método 'chat' del service 'anamnesisService', que se encarga de:
    - genera un promp con instrucciones para openai, indicando su rol (nutricionista), que debe hacer (
      recopilar informacion y completar los campos de Anamnesis base a la informacion antigua de anamnesis
      y la información nueva recopilada), y el formato del output de debe devolver.
    - le entrega a openai el promp generado + el mensaje del user, y openai devuelve una anamnesis más 
      completa y un mensaje de respuesta 
    - maneja errores, como que openai devuelva un reply vacío
    - normaliza el output

## /consulta/procesar (modulo consulta)
- Este endpoint se encarga de recibir la informacion recopilada y devolver un objeto con la informacion del plan nutricional
- Implementa el método 'procesar' del service 'consultaService', que se encarga de:
    - extraer información necesaria del body para el calculo de requerimientos
    - llama al service de openai, entregandole la información recopilada + el promp con instrucciones
      para la generación de un objeto con la información del plan nutricional