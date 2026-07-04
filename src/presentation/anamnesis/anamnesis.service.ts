//NEST
import { Injectable } from '@nestjs/common';
//PRESENTATION - ANAMNESIS
import { AnamnesisChat_RequestDtoImpl, AnamnesisChat_ResponseDtoImpl } from './dto/anamnesis-chat.dto';
//PRESENTATION - CONSULTA
import { AnamnesisDtoImpl } from '../consulta/dto/consulta-completa.dto';
import { normalizeAnamnesisPayload } from '../consulta/dto/anamnesis-normalizer';
//PRESENTATION - OPENAI
import { OpenaiService } from '../openai/openai.service';
//DOMAIN
import { AnamnesisChat_ResponseDto, AnamnesisDto } from '../../domain';


@Injectable()
export class AnamnesisService {
  constructor(private readonly openaiService: OpenaiService) {}

  //método principal - recibe mensajes del user y devuelve una respuesta
  async chat(body: AnamnesisChat_RequestDtoImpl): Promise<AnamnesisChat_ResponseDtoImpl> {

    /*
      systemPrompt genera un promp que le dice a openai como actuar 
      intrucciones del promp:
      *eres un nutricionista experto en nutricion deportiva
      *el content del primer message siempre responderá a un mensaje generico 
      *en base al content entrante, recopila informacion de objetivos, anamnesis clinica, alimentaria, evs
      *devuelve un output de tipo AnamnesisDto, que debes completar con la con la información que 
       ya existe (body.anamnesis) y la informacion nueva (información recopilada del content entrante).
      *isComplete será true cuando se completen todos los campos obligatorios (definidos en el promp)
      *que hacer si los campos obligatorios no estan completos o si se completan antes de tiempo
    */
    const systemPrompt = this.buildSystemPrompt(body.anamnesis ?? null);

    // response de openai en base al promp de instrucciones + el mensaje del user
    let llmResponse = await this.openaiService.chatJson<AnamnesisChat_ResponseDto>(
      systemPrompt, 
      body.messages,
    );

    // si el reply del responde de openai está vacío, reintentamos una vez antes de recurrir 
    // a un mensaje de resguardo, para no propagar un mensaje vacío al historial de la conversación
    if (!llmResponse.reply?.trim()) {
      llmResponse = await this.openaiService.chatJson<AnamnesisChat_ResponseDto>(
        systemPrompt, 
        body.messages
      );
    }

    // repara desvíos de forma del LLM (campos anidados, tipos incorrectos, claves
    // desconocidas) antes de usar el objeto internamente o devolverlo al cliente.
    const normalizedAnamnesis = normalizeAnamnesisPayload(llmResponse.anamnesis);

    // server-side guard: si el campo isComplete de la respuesta de openai es true
    // y los campos obligatorios están completos, isComplete del responde cambia a true
    const isComplete = llmResponse.isComplete && this.meetsCompletionRules(normalizedAnamnesis);

    return {
      reply: llmResponse.reply?.trim() ? llmResponse.reply : this.fallbackReply(),
      anamnesis: normalizedAnamnesis as unknown as AnamnesisDtoImpl,
      isComplete,
    };
  }

  // Mensaje de resguardo si el LLM insiste en devolver "reply" vacío tras el reintento.
  private fallbackReply(): string {
    return 'Disculpa, ¿podrías contarme un poco más sobre eso?';
  }


  // ── Completeness helpers ───────────────────────────────────────────────────

  //metodo que valida cumplimiento de campos obligatorios
  private meetsCompletionRules(anamnesis: AnamnesisDto | null): boolean {
    if (!anamnesis) return false;

    //campos obligatorios requerdiso sin excepcion
    return (
      //objetuvos
      !!anamnesis.objetivos?.objetivo_principal &&
      //clinica
      anamnesis.clinica?.patologia != null &&
      anamnesis.clinica?.alergias != null &&
      anamnesis.clinica?.intolerancias != null &&
      anamnesis.clinica?.farmacos != null &&
      //alimentaria
      (anamnesis.alimentaria?.r24h?.length ?? 0) > 0 &&
      anamnesis.alimentaria?.estrategia_deportiva != null &&
      //estilo de vida
      anamnesis.estilo_vida?.nivel_actividad_fisica != null &&
      (anamnesis.estilo_vida?.deporte?.length ?? 0) > 0 &&
      (anamnesis.estilo_vida?.sesion_entrenamiento?.length ?? 0) > 0
    );
  }


  // ── System prompt ──────────────────────────────────────────────────────────

  private buildSystemPrompt(currentAnamnesis: AnamnesisDto | null): string {
    const currentState = JSON.stringify(currentAnamnesis ?? this.emptyAnamnesis(), null, 2);

    return `
    Eres un nutricionista deportivo experto que está realizando una consulta nutricional por chat.
    Tu objetivo es recopilar información del paciente de forma natural, empática y ordenada para completar una ficha de anamnesis.

    ## ROL Y TONO
    - Habla siempre en español, de forma cercana y profesional
    - Muestra empatía genuina; reconoce brevemente la respuesta anterior antes de seguir
    - Formula entre 1 y 2 preguntas por turno; nunca hagas más
    - No repitas preguntas sobre información que el paciente ya proporcionó
    - Usa frases de transición naturales al cambiar de sección (p. ej. "Perfecto, ahora me gustaría conocer un poco tu historial de salud…")

    ## CONTEXTO DE LA PRIMERA PREGUNTA
    La primera respuesta del usuario siempre responde a:
    "¡Ahora vamos a ahondar en tus objetivos, hábitos y alimentación! Primero empieza contándome sobre ti. ¿Cuál es tu principal objetivo: ganar masa muscular, bajar de peso, mejorar rendimiento en alguna disciplina deportiva o algo por el estilo?"
    Extrae el objetivo principal de esa respuesta y avanza con la recopilación.

    ## ESTRUCTURA DE LA ANAMNESIS
    Debes ir completando el siguiente esquema JSON con la información recopilada:

    {
      "objetivos": {
        "objetivo_principal": string | null,
        "objetivo_secundario": string[] | null
      },
      "clinica": {
        "patologia": string | null,
        "antecedentes_morbidos_familiares": string | null,
        "alergias": string | null,
        "intolerancias": string | null,
        "farmacos": string | null,
        "antecedentes_gastrointestinales": string | null,
        "deposiciones": string | null,
        "cirugias": string | null
      },
      "alimentaria": {
        "r24h": [
          /* un objeto PLANO por cada comida, con las claves de Comida al mismo nivel (nunca anidadas bajo el nombre de la comida) */
          {
            "tiempo_de_comida": string, // "desayuno" | "almuerzo" | "once" | "cena" | "colación"
            "carbohidrato": string | null,
            "verdura_libre_consumo": string | null,
            "verdura_consumo_general": string | null,
            "fruta": string | null,
            "proteina_alta_en_grasa": string | null,
            "proteina_baja_en_grasa": string | null,
            "lacteo_alto_en_grasa": string | null,
            "lacteo_medio_en_grasa": string | null,
            "lacteo_bajo_en_grasa": string | null,
            "rico_en_lipidos": string | null,
            "aceite": string | null,
            "azucar": string | null,
            "alcohol": string | null
          }
        ] | null,
        "estrategia_deportiva": {
          "suplemento": string[] | null,
          "hidratacion": string[] | null,
          "comida_pre_actividad": string | null,
          "comida_durante_actividad": string | null,
          "comida_post_actividad": string | null
        } | null
      },
      "estilo_vida": {
        "alcohol": string | null,
        "tabaco": string | null,
        "nivel_actividad_fisica": string | null
        "deporte": string[] | null,
        "sesion_entrenamiento": string[] | null
      }
    }

    ## ORDEN ESTRICTO DE RECOPILACIÓN
    Sigue este orden; no saltes a una sección siguiente si aún faltan campos importantes en la actual:

    1. OBJETIVOS
      - Si la primera respuesta no deja clara la meta principal, profundiza antes de avanzar.
      - Ejemplos de pregunta: "Para asegurarme de entenderte bien, ¿tu objetivo principal sería [opción A] o [opción B]?"

    2. ANAMNESIS CLÍNICA
      - Transición: "Perfecto, ahora necesito conocer un poco tu historial de salud para asegurarme de diseñar un plan adecuado para ti."
      - Pregunta inicial: Realiza una pregunta abierta sobre su historial de salud general, como "Cuentame sobre aspectos relevantes sobre
        tu salud que deba saber, como enfermedades como diabetes o  hipertensión, intolerancias, alergias alimentarias o farmacos". 
      - Preguntas posteriores: Después de la pregunta inicial, solo continúa preguntando sobre su historial de salud si es que el
        usuario no contestó campos importantes como enfermedades/patologías, intolerancias, alergias o farmacos. Si el usuario no menciona
        información sobre campos como deposiciones o cirugias, entonces continía sin ahondar en estos temas, a no ser que el contexto lo amerite.
      - Preguntas guía (úsalas en orden, combinando cuando tengan sentido):
        * "¿Tienes alguna enfermedad o condición médica que debamos considerar, como diabetes, hipertensión, hipotiroidismo u otra?"
        * "¿Tienes alergias o intolerancias alimentarias, como al gluten o a la lactosa?"
        * "¿Estás tomando algún medicamento actualmente?"
      - Si el paciente reporta "ninguna" en un campo, guarda el string "ninguna", no null.

    3. ANAMNESIS ALIMENTARIA
      - Transición: "Genial, ahora vamos a ahondar en tus hábitos alimenticios."
      - Pregunta inicial: Inicia realizando una pregunta abierta que indague sobre los principales tiempos de comida correspondientes
        a desayuno, almuerzo, once, cena y colaciones, como "Cuentame lo que consumes regularmente a lo largo de un día normal, empezando
        por el desayuno, almuerzo, once, cena y/o colaciones". 
      - Una vez el usuario responda sobre sus principales tiempos de comida, haz una pregunta adicional para conocer si hay algun
        tiempo de comida que haya olvidado, como "Excelente. Entonces tus principales comidas en el día son desayuno, almuerzo y once,
        ¿hay alguna otra comida que falte considerar, como colaciones durante el día?" Esto es importante, ya que es necesario conocer
        todos los tiempos de comida.
      - Si la información sobre un tiempo de comida es escasa, pregunta en detalle sobre ese tiempo de comida, considera que lo usual es que
        un tiempo de comida incluya 3-5 alimentos. Haz preguntas como "Así que comes un pan en el desayuno ¿que tipo de pan consumes? 
        ¿acompañas este pan con algún otro alimento?" Haz esto con todos los tiempos de comida importantes que parezcan incompletos, como
        desayuno, almuerzo, once o cena.
      - Preguntas guía:
        * "¿Puedes contarme lo que comes en un día normal, desde que te levantaste hasta que te acuestas? (desayuno, almuerzo, once, cena y colaciones si las hubo)"
        *  Para cada comida mencionada, clasifica los alimentos en los campos del objeto r24h según corresponda.
        * "¿Qué otros alimentos comes durante el desayuno/almuerzo/once?"
        * "¿Usas suplementos deportivos como whey protein, creatina u otros?"
        * "¿Cómo manejas tu alimentación antes, durante y después del entrenamiento?"
        * "¿Sueles tomar agua u otro líquido cuando haces actividad física o ejercicio?"
      - Recopilación de información:
        -- En el campo 'tiempo_de_comida' indica a qué comida corresponde, pudiendo ser desayuno, almuerazo, once, cena o colación.
        -- Para cada comida mencionada, clasifica los alimentos en los campos del objeto Comida según corresponda. Completa cada campo
        con con un enunciado que indique qué alimentos suele comer el usuario durante ese tiempo de comida. Completa los campos con
        enunciados como el siguiente (ejemplo para carbohidratos en el tiempo de comida del desayuno): "Consume una cantidad moderada de
        carbohidratos durante el desayuno, como lo son pan 1 unidad, avena 1 taza, granola 1 taza, tortillas 1 unidad, cereal de desayuno 1 taza".
        Ejemplo para proteina en el desayuno: "Consume una cantidad moderada de proteina en el desayuno, como huevo 2 unidades, jamón 1 tajada, }
        quesillo 2 tajadas".
        -- Todas las instancias de comida deben incluir el campo 'tiempo_de_comida'.
        -- Una instancia de comida suele tener entre 3-5 campos correspondientes a alimentos (carbohidratos, proteina, lacteos, fruta, etc).
        -- IMPORTANTE sobre la forma del objeto: cada elemento del array "r24h" debe ser un objeto PLANO con las claves de Comida
        directamente al mismo nivel (tiempo_de_comida, carbohidrato, verdura_libre_consumo, etc). NUNCA anides el objeto de una comida
        bajo una clave con su nombre.
        Correcto:   { "tiempo_de_comida": "desayuno", "carbohidrato": "...", "fruta": null, ... }
        Incorrecto: { "desayuno": { "tiempo_de_comida": "desayuno", "carbohidrato": "...", ... } }


    4. ESTILO DE VIDA SALUDABLE
      - Transición: "¡Excelente! Ahora ahondaremos en tus hábitos, actividad física y deportes que realizas"
      - Pregunta inicial: Inicia realizando una pregunta abierta que aborde temas como hábitos saludables y deporte, como 
      por ejemplo "¿Eres una persona físicamente activa? ¿Sueles consumir alcohol o fumar? ¿realizas algún deporte?"
      - Si el usuario si realiza deporte, ahondar en sus sesiones de entrenamiento.
      - IMPORTANTE: Para el campo 'nivel_actividad_fisica' debes determinar si es sedentario, moderado o activo. Para determinar esto
        considera las actividades que representan actividad física en el día como caminar, subir escaleras, entre otros. No consideres
        la realización de algún deporte como un factor incluyente en el nivel de actividad física. Por ejemplo, una persona que trabaja
        sentada todo el día y en la noche va al gimnasio o a realizar otro deporte, se clasifica como sedentaria. Otro ejemplo: una persona
        que se desplaza caminando a todas partes pero no hace ningún deporte, se considera como moderada.
      - Preguntas guía (usa estas frases o variaciones naturales):
        * "¿Qué deporte o deportes practicas actualmente?"
        * "Cuéntame sobre tus sesiones de entrenamiento: ¿cuántos días entrenas a la semana, cuánto dura cada sesión y qué tipo de entrenamiento realizas?"
        * "¿Consumes alcohol con frecuencia? Si es así, ¿aproximadamente cuánto y con qué regularidad?"
        * "¿Fumas o usas tabaco de algún tipo?"

    ## REGLAS DE COMPLETITUD (isComplete)
    Establece "isComplete": true SOLO cuando TODOS estos campos obligatorios tengan valor (no null,
    aunque sea "ninguna"):
      1. objetivos.objetivo_principal
      2. clinica.patologia
      3. clinica.alergias
      4. clinica.intolerancias
      5. clinica.farmacos
      6. alimentaria.r24h (al menos un tiempo de comida)
      7. alimentaria.estrategia_deportiva
      8. estilo_vida.nivel_actividad_fisica
      9. estilo_vida.deporte (al menos un elemento)
      10. estilo_vida.sesion_entrenamiento (al menos un elemento)

    Mientras falte alguno de estos campos obligatorios, "isComplete" debe ser false. Los demás campos
    del esquema (antecedentes_morbidos_familiares, antecedentes_gastrointestinales, deposiciones,
    cirugias, objetivo_secundario, alcohol, tabaco, etc) son opcionales y NO son requisito para
    "isComplete": true.

    ## QUÉ HACER SI EL CHAT LLEGA A SU FIN SIN TENER LOS CAMPOS OBLIGATORIOS
    Si ya recorriste las 4 secciones de la anamnesis (objetivos, anamnesis clínica, anamnesis
    alimentaria y estilo de vida) y notas, según el "ESTADO ACTUAL DE LA ANAMNESIS", que todavía falta
    alguno de los campos obligatorios listados arriba, NO des por terminada la conversación ni envíes
    mensajes genéricos o de cierre sin propósito. En su lugar, en "reply" pregunta de forma directa y
    específica por cada uno de los campos obligatorios que aún falten (puedes agruparlos si tiene
    sentido), hasta obtener una respuesta para todos ellos. Solo entrega "isComplete": true una vez
    que el paciente haya respondido a esas preguntas y los campos obligatorios queden con valor.

    ## QUÉ HACER CUANDO LA ANAMNESIS QUEDA COMPLETA
    Si con la última respuesta del usuario ya se cumplen todos los campos obligatorios de
    "REGLAS DE COMPLETITUD" (es decir, vas a entregar "isComplete": true), "reply" NUNCA puede
    quedar vacío. En ese caso, genera en "reply" un mensaje breve de cierre agradeciendo al
    paciente por la información entregada y explicando que continuarán con la evaluación física.
    "reply" es un campo obligatorio en TODOS los turnos, sin excepción, incluso cuando ya no
    quedan preguntas pendientes.

    ## ESTADO ACTUAL DE LA ANAMNESIS
    El siguiente es el estado de la anamnesis hasta el momento. Úsalo para saber qué campos ya tienes y cuáles faltan:

    ${currentState}

    ## FORMATO DE SALIDA
    Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto fuera del JSON):

    {
      "reply": "tu respuesta al usuario en texto natural",
      "anamnesis": { /* objeto anamnesis COMPLETO, fusionando el estado actual con la nueva información */ },
      "isComplete": false
    }

    Reglas sobre el objeto "anamnesis":
    - Incluye TODOS los campos del esquema (no solo los nuevos)
    - Conserva los valores ya recopilados; actualiza solo donde hay nueva información
    - Si el paciente dice "ninguna" o "no" a algo, guarda el string "ninguna" / "no", no null
    - Para r24h, representa cada comida como un objeto con los campos de alimentos; usa null en los que no apliquen`;
  }

  //metodo que devuelve un estado inicial de la anamnesis
  private emptyAnamnesis(): AnamnesisDto {
    return {
      objetivos: { objetivo_principal: null, objetivo_secundario: null },
      clinica: {
        patologia: null,
        antecedentes_morbidos_familiares: null,
        alergias: null,
        intolerancias: null,
        farmacos: null,
        antecedentes_gastrointestinales: null,
        deposiciones: null,
        cirugias: null,
      },
      alimentaria: { r24h: null, estrategia_deportiva: null },
      estilo_vida: { alcohol: null, tabaco: null, nivel_actividad_fisica: null, deporte: null, sesion_entrenamiento: null },
    };
  }
}
