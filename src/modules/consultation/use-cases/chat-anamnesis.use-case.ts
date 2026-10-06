//NEST
import { Injectable } from '@nestjs/common';
//CONSULTATION
import { InputChatDtoImpl, OutputChatDtoImpl } from '../dto/anamnesis-chat.dto';
import { AnamnesisDtoImpl } from '../dto/consultation.dto';
import { normalizeAnamnesisPayload } from '../dto/anamnesis-normalizer';
import { buildAnamnesisChatSystemPrompt } from '../prompts/anamnesis-chat.prompt';
//DOMAIN
import { OutputChatDto, AnamnesisDto } from '../../../domain';
import { LlmProvider } from '../../../domain/ports';


// CU-CON-01. Este endpoint (POST /consultations/chat) puede ser usado por cualquier visitante de la página, incluso
// sin llegar a pagar: se mantiene en el modelo económico actual para no disparar costos por tráfico
// curioso. Configurable vía env var sin necesidad de redeploy.
// Se lee en cada uso (función): al importar este archivo el .env todavía no está cargado.
const consultationModel = () => process.env.OPENAI_MODEL_CONSULTA ?? 'gpt-4o-mini';

@Injectable()
export class ChatAnamnesisUseCase {
  constructor(private readonly llm: LlmProvider) {}

  //método principal - recibe mensajes del user y devuelve una respuesta
  async execute(body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {

    /*
      systemPrompt genera un prompt que le dice a openai como actuar
      intrucciones del prompt:
      *eres un nutricionista experto en nutricion deportiva
      *el content del primer message siempre responderá a un mensaje generico
      *en base al content entrante, recopila informacion de objetivos, anamnesis clinica, alimentaria, evs
      *devuelve un output de tipo AnamnesisDto, que debes completar con la con la información que
       ya existe (body.anamnesis) y la informacion nueva (información recopilada del content entrante).
      *isComplete será true cuando se completen todos los campos obligatorios (definidos en el prompt)
      *que hacer si los campos obligatorios no estan completos o si se completan antes de tiempo
    */
    const systemPrompt = buildAnamnesisChatSystemPrompt(body.anamnesis ?? null);

    // response de openai en base al prompt de instrucciones + el mensaje del user
    let llmResponse = await this.llm.chatJson<OutputChatDto>(
      systemPrompt,
      body.messages,
      consultationModel(),
    );

    // si el reply del responde de openai está vacío, reintentamos una vez antes de recurrir
    // a un mensaje de resguardo, para no propagar un mensaje vacío al historial de la conversación
    if (!llmResponse.reply?.trim()) {
      llmResponse = await this.llm.chatJson<OutputChatDto>(
        systemPrompt,
        body.messages,
        consultationModel(),
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
      titleReply: llmResponse.titleReply?.trim() ? llmResponse.titleReply : this.fallbackTitleReply(),
      anamnesis: normalizedAnamnesis as unknown as AnamnesisDtoImpl,
      isComplete,
    };
  }

  // Mensaje de resguardo si el LLM insiste en devolver "reply" vacío tras el reintento.
  private fallbackReply(): string {
    return 'Disculpa, ¿podrías contarme un poco más sobre eso?';
  }

  // Título de resguardo si el LLM devuelve "titleReply" vacío.
  private fallbackTitleReply(): string {
    return 'Continuando con la consulta';
  }


  // ── Completeness helpers ───────────────────────────────────────────────────

  //metodo que valida cumplimiento de campos obligatorios
  private meetsCompletionRules(anamnesis: AnamnesisDto | null): boolean {
    if (!anamnesis) return false;

    //campos obligatorios requerdiso sin excepcion
    return (
      //objetuvos
      !!anamnesis.goals?.primaryGoal &&
      //clinica
      anamnesis.clinical?.pathology != null &&
      anamnesis.clinical?.allergies != null &&
      anamnesis.clinical?.intolerances != null &&
      anamnesis.clinical?.medications != null &&
      //alimentaria
      (anamnesis.dietary?.r24h?.length ?? 0) > 0 &&
      anamnesis.dietary?.sportsStrategy != null &&
      //estilo de vida
      anamnesis.lifestyle?.physicalActivityLevel != null &&
      (anamnesis.lifestyle?.sport?.length ?? 0) > 0 &&
      this.sportSessionsComplete(anamnesis.lifestyle?.sportSession ?? null)
    );
  }

  // valida que exista al menos una sportSession y que CADA una tenga sus 7 campos
  // completos (no basta con que el array no esté vacío)
  private sportSessionsComplete(
    sessions: NonNullable<AnamnesisDto['lifestyle']>['sportSession'],
  ): boolean {
    if (!sessions || sessions.length === 0) return false;
    return sessions.every(
      (s) =>
        s.description != null &&
        s.discipline != null &&
        s.duration != null &&
        s.intensity != null &&
        s.eventType != null &&
        s.days != null &&
        s.schedule != null,
    );
  }
}
