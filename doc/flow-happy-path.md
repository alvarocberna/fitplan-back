# Flujo happy path — Consulta nutricional

Este documento describe, paso a paso, el recorrido completo de una consulta que **sí llega a buen
puerto**: el paciente completa sus datos, conversa con la IA, paga y recibe su plan nutricional. Por
cada paso se indica la pantalla del frontend (`nutricionista-virtual-front`) involucrada y el/los endpoint(s)
del backend (`nutricionista-virtual-back`) que se consumen, en el orden real en que ocurren.

No cubre casos de error, reintentos de pago fallido, ni edge cases — para eso ver el código de cada
servicio (comentarios inline) y `doc/deuda-tecnica.md`.

## Actores

- **Frontend**: Next.js (`nutricionista-virtual-front`), guarda el estado del flujo (`informacionPersonal`,
  `anamnesis`, `mediciones`) en `ConsultaContext`, persistido en `localStorage`
  (`src/shared/context/consulta.context.tsx`) para sobrevivir refrescos de página.
- **Backend**: NestJS (`nutricionista-virtual-back`), expone los endpoints REST.
- **OpenAI**: usado en 3 puntos del flujo (chat de anamnesis, extracción de nivel de actividad/objetivo,
  generación del plan).
- **Base de datos**: Postgresql vía Prisma, con una única tabla `orden` (`prisma/schema.prisma`) que
  persiste el payload de la consulta, el estado de pago/generación y el plan resultante.
- **Pasarela de pago**: hoy **simulada** — no hay integración real con Mercado Pago/Flow/Stripe. El
  botón "Pagar" dispara el mismo endpoint que dispararía el webhook real de una pasarela.

## Diagrama de secuencia

```mermaid
sequenceDiagram
    actor Paciente
    participant FE as Frontend
    participant BE as Backend
    participant AI as OpenAI
    participant DB as SQLite (orden)

    Paciente->>FE: /consulta/informacion-personal (form)
    Note over FE: guarda en ConsultaContext, sin llamada API

    loop por cada turno del chat
        Paciente->>FE: /consulta/anamnesis (mensaje)
        FE->>BE: POST /consulta/chat
        BE->>AI: chatJson (system prompt + historial)
        AI-->>BE: reply, anamnesis, isComplete
        BE-->>FE: reply, titleReply, anamnesis, isComplete
    end

    Paciente->>FE: /consulta/evaluacion-fisica (peso, talla)
    Note over FE: guarda en ConsultaContext, sin llamada API

    Paciente->>FE: /consulta/generar-orden ("Realizar pago")
    FE->>BE: POST /ordenes/crear (ConsultaCompletaDto)
    BE->>DB: INSERT orden (estado_pago='pendiente')
    BE-->>FE: { orden_id }
    FE->>Paciente: redirige a /pago/{orden_id}

    Paciente->>FE: /pago/[ordenId] ("Pagar")
    FE->>BE: POST /webhooks/ordenes/:id/simular-pago
    BE->>DB: UPDATE orden estado_pago='pagado'
    BE-->>FE: { estado: 'procesado' }
    FE->>Paciente: redirige a /ordenes/{ordenId}

    par generación en background (fire-and-forget)
        BE->>AI: extraerInfoPromp (nivel_actividad_fisica, objetivo)
        AI-->>BE: InfoPromp
        Note over BE: calculoRequerimientos + calculoSuplementos (sin IA)
        BE->>AI: generación del plan (NUTRICIONISTA_SYSTEM_PROMPT)
        AI-->>BE: PlanNutricionalGenerado
        BE->>DB: UPDATE orden plan_json, estado_generacion='completado'
        Note over BE: genera PDF y "envía" el correo (stub)
    and polling del frontend
        loop cada 4s hasta 'completado' o 'error'
            FE->>BE: GET /ordenes/obtener-estado/:id
            BE-->>FE: estado_pago, estado_generacion, plan_json
        end
    end

    FE->>Paciente: muestra plan + botón de descarga PDF (client-side)
```

## Paso a paso

### 1. `/consulta/iniciar-consulta` — pantalla informativa

Sin llamadas al backend. Solo explica los pasos de la consulta y enlaza a
`/consulta/informacion-personal`.

### 2. `/consulta/informacion-personal` — datos personales

`FormUserInfo` recoge nombre, apellidos, género, correo, fecha de nacimiento (RUT no está en uso
activo). Al enviar, se guarda en `ConsultaContext.setInformacionPersonal` (persistido en
`localStorage`) y se navega a `/consulta/anamnesis`. **No hay llamada al backend en este paso.**

### 3. `/consulta/anamnesis` — chat con la IA ("Nuvi")

`ChatAnamnesis` intercambia mensajes con el backend, un turno a la vez:

- **`POST /consulta/chat`** (`ConsultaController.chat` → `ConsultaService.chat`)
  - Request: `{ messages: {role, content}[], anamnesis?: AnamnesisDto }` (el estado acumulado de
    turnos anteriores).
  - El backend arma un system prompt con el esquema completo de la anamnesis, el orden estricto de
    recopilación (objetivos → clínica → alimentaria [r24h → preferencias → estrategia deportiva] →
    estilo de vida) y las reglas de completitud, y llama a OpenAI (`OpenaiService.chatJson`).
  - Normaliza la forma del `anamnesis` devuelto por el LLM (`normalizeAnamnesisPayload`) y recalcula
    `isComplete` en el servidor (`meetsCompletionRules`) en vez de confiar en el LLM.
  - Response: `{ reply, titleReply, anamnesis, isComplete }`.
- Este endpoint se llama **una vez por cada turno del paciente** (típicamente entre 8 y 15 turnos,
  según cuánto detalle dé el paciente) hasta que `isComplete === true`.
- Cuando `isComplete` es `true`, el frontend guarda el `anamnesis` final en `ConsultaContext` y navega
  a `/consulta/evaluacion-fisica`.

### 4. `/consulta/evaluacion-fisica` — datos antropométricos

`FormMediciones` recoge peso y talla (el resto de mediciones antropométricas del DTO —pliegues,
perímetros, diámetros— existen en el modelo pero no se piden en este formulario todavía). Se guarda
en `ConsultaContext.setMediciones` y se navega a `/consulta/generar-orden`. **Sin llamada al
backend.**

### 5. `/consulta/generar-orden` — resumen y creación de la orden

Pantalla de resumen/checkout. Al presionar "Realizar pago" (`BtnGenerarOrden`):

- **`POST /ordenes/crear`** (`OrdenesController.crear` → `OrdenesService.crearOrden`)
  - Request: `ConsultaCompletaDto` completo — `{ informacion_personal, anamnesis, mediciones }`,
    armado con las tres piezas de estado acumuladas en `ConsultaContext`.
  - El backend crea una fila en la tabla `orden` (SQLite) con `estado_pago='pendiente'`,
    `estado_generacion='no_iniciado'` y `payload_json` = el body completo serializado. **La IA
    todavía no se ejecuta en este paso** — se crea la orden antes de cobrar para no perder los datos
    del paciente si el pago falla o el usuario cierra la pestaña.
  - Response: `{ orden_id }`.
- El frontend redirige a `/pago/{orden_id}`.

### 6. `/pago/[ordenId]` — pasarela de pago (simulada)

Checkout **simulado**: los campos de tarjeta son decorativos y no validan nada. Al presionar "Pagar":

- **`POST /webhooks/ordenes/:id/simular-pago`** (`WebhooksController.simularPago` →
  `WebhooksService.procesarPago`)
  - Pensado como sustituto temporal del webhook real de una pasarela de pago (`POST /webhooks/pago`,
    que ya existe con la misma lógica y validación de firma — hoy un stub que siempre pasa — pero no
    tiene ninguna pasarela real que lo dispare aún).
  - Marca la orden `estado_pago: 'pendiente' → 'pagado'` (operación idempotente: si ya estaba pagada,
    no hace nada y responde `{ estado: 'ya_procesado' }`).
  - Dispara **en background** (fire-and-forget, sin esperar el resultado) la generación del plan:
    `GeneracionPlanService.generarPlan(ordenId)`. El endpoint responde de inmediato con
    `{ estado: 'procesado' }`, sin esperar a que el plan esté listo.
- El frontend redirige a `/ordenes/{ordenId}`.

### 7. Generación del plan (proceso en segundo plano, sin request HTTP del frontend)

Disparado por el paso anterior, corre del lado del backend sin que el frontend lo invoque
directamente (`GeneracionPlanService.generarPlan`):

1. **Guard de estado**: solo continúa si `estado_generacion` es `no_iniciado` o `error` (evita que dos
   disparos concurrentes — p. ej. un reintento manual del webhook — generen el plan dos veces).
2. **Llamada a OpenAI** (`EXTRAER_INFO_SYSTEM_PROMPT`) para clasificar, a partir de la anamnesis, el
   `nivel_actividad_fisica` (sedentario/moderado/activo) y el `objetivo` (definición/mantención/volumen).
3. **Cálculo local (sin IA)** de edad, requerimientos energéticos (TMB, GET, macros —
   `calculoRequerimientos`) y prescripción de suplementos (`calculoSuplementos`), a partir de peso,
   talla, sexo, edad, nivel de actividad y objetivo.
4. **Llamada a OpenAI** (`NUTRICIONISTA_SYSTEM_PROMPT`) para generar el plan completo: régimen,
   distribución de tiempos de comida (en porciones por grupo de intercambio de alimentos, ver
   `PORCIONES_GRUPOS_ALIMENTOS`), suplementos y recomendaciones deportivas — usando **exactamente**
   los requerimientos ya calculados en el paso 3 (no se le permite a la IA recalcularlos).
5. **Reintentos**: hasta 4 intentos con backoff exponencial (1s, 2s, 4s, 8s) si cualquiera de las
   llamadas anteriores falla.
   - Si tiene éxito: guarda `plan_json` en la orden y marca `estado_generacion: 'completado'`, luego
     llama a `EmailService.enviarPlanPorCorreo` — genera el PDF del plan server-side (`PdfService`,
     `@react-pdf/renderer`) y "envía" el correo (hoy es un stub que solo logea; no hay proveedor de
     email real conectado todavía).
   - Si fallan los 4 intentos: marca `estado_generacion: 'error'` y registra el evento (log
     estructurado; sin alerta real todavía, ver `doc/deuda-tecnica.md`).

### 8. `/ordenes/[id]` — espera y resultado

Mientras el paso 7 corre en segundo plano, esta pantalla hace **polling cada 4 segundos** a:

- **`GET /ordenes/obtener-estado/:id`** (`OrdenesController.obtenerEstado` →
  `OrdenesService.obtenerEstado`)
  - Response: `{ estado_pago, estado_generacion, plan_json }` (sin `payload_json`, que es información
    interna del pipeline).
- Mientras `estado_generacion` sea `'no_iniciado'` o `'generando'`, se muestra un spinner (y, pasados
  45s sin terminar, un aviso de demora que tranquiliza al paciente: el pago ya quedó registrado).
- Cuando `estado_generacion === 'completado'`, se muestra el plan y un botón de descarga que genera el
  PDF **en el cliente** (mismo documento react-pdf que usa el backend para el adjunto del correo, pero
  ejecutado en el navegador — no hay llamada adicional al backend para esto).
- Si `estado_generacion === 'error'`, se muestra un mensaje indicando que el pago quedó registrado y
  que el equipo ya fue notificado (vía el log del paso 7).

## Tabla resumen de endpoints (en orden de uso)

| # | Endpoint | Pantalla que lo dispara | Repeticiones | Efecto |
|---|---|---|---|---|
| 1 | `POST /consulta/chat` | `/consulta/anamnesis` | 1 vez por turno del chat | Llama a OpenAI, devuelve la siguiente pregunta y el estado acumulado de la anamnesis |
| 2 | `POST /ordenes/crear` | `/consulta/generar-orden` | 1 vez | Crea la orden en SQLite (`estado_pago='pendiente'`), sin llamar a la IA todavía |
| 3 | `POST /webhooks/ordenes/:id/simular-pago` | `/pago/[ordenId]` | 1 vez | Marca la orden como pagada y dispara la generación del plan en background |
| — | *(sin request del frontend)* | — | — | `GeneracionPlanService.generarPlan`: 2 llamadas a OpenAI + cálculo local + guardado del plan + envío de correo (stub) |
| 4 | `GET /ordenes/obtener-estado/:id` | `/ordenes/[id]` | cada 4s hasta `completado`/`error` | Polling del estado de pago/generación y, al terminar, del plan generado |

Endpoint equivalente no usado en este flujo (queda para cuando se integre una pasarela real):
**`POST /webhooks/pago`** — mismo efecto que el endpoint #3, pero pensado para ser llamado por la
pasarela de pago real en vez de por el frontend.

## Notas relevantes

- **El flujo ya no es stateless**: a diferencia de una versión anterior de este proyecto (ver
  `README.md`), el estado de la orden (payload, estado de pago, estado de generación, plan
  resultante) se persiste en SQLite vía Prisma (tabla `orden`, `prisma/schema.prisma`), porque el
  webhook de pago es server-a-server y no tiene acceso al `localStorage` del navegador del paciente.
- **La IA se ejecuta 3 veces en total por consulta**: una vez por turno en el chat de anamnesis (paso
  3), y dos veces más en la generación del plan (extracción de nivel de actividad/objetivo + generación
  del plan en sí, paso 7).
- **El pago es simulado**: no hay pasarela real integrada. El endpoint que sí quedaría para producción
  (`POST /webhooks/pago`, con verificación de firma) existe pero su verificación
  (`WebhooksService.verificarFirmaWebhook`) siempre devuelve `true` hoy.
- **El envío de correo es un stub**: `EmailService.enviarCorreoReal` solo logea, no hay proveedor
  (SendGrid/SES/Resend/etc.) conectado. El PDF sí se genera de verdad (server-side para el adjunto,
  client-side para la descarga manual).
- **Retención de datos**: un cron diario (`RetencionService`, 03:00) anonimiza (`payload_json` y
  `plan_json` → `null`) las órdenes con más de 45 días, conservando la fila para auditoría/estadística.
