# Autenticación — módulo `presentation/auth/`

Este documento describe cómo el backend valida la identidad de un usuario autenticado con Amazon
Cognito (desde `nutricionista-virtual-front`) y cómo esa identidad se conecta con `User`/
`AuthIdentity` en Postgres. El flujo completo, incluida la parte del frontend (Hosted UI, Server
Actions, refresh de tokens), está en `nutricionista-virtual-front/doc/auth.md` y
`nutricionista-virtual-front/doc/flow.md` — este documento se enfoca en lo que vive en este repo.

## Idea central: identidad separada de perfil

Dos conceptos que antes estaban mezclados en un solo paso (crear la orden) y ahora están separados:

1. **Identidad (`AuthIdentity` + `User` "esqueleto")** — se crea apenas hay una sesión de Cognito
   válida, vía `POST /auth/perfil`. Lo único garantizado en ese momento es el `sub` (del token) y
   el `email` (de la sesión de Cognito del frontend, no de un formulario).
2. **Perfil (`User` completo)** — RUT, nombre, apellidos, género, fecha de nacimiento. Cognito
   **no** provee ninguno de estos datos (el scope OIDC en uso es `openid email phone`, sin
   `profile`, y aunque se agregara `profile`, Google no comparte género ni fecha de nacimiento por
   esa vía). Se completan en un formulario propio de la app, vía `PATCH /auth/perfil`.

Por esto, `User.firstName`/`paternalLastName`/`gender`/`dateOfBirth` son **nullable** en el schema
(migración `relax_user_profile_fields`) — un `User` recién registrado existe con esos campos en
`null` hasta que completa el formulario. `ordenes/crear` valida explícitamente que el perfil esté
completo antes de crear una orden (ver más abajo); la nulabilidad a nivel de base de datos modela
ese estado intermedio real, no es un descuido.

## `CognitoAuthGuard` (`cognito-auth.guard.ts`)

`CanActivate` que:
1. Lee el header `Authorization: Bearer <token>`. Sin header → `401 UnauthorizedException`.
2. Verifica el token con `aws-jwt-verify` (`CognitoJwtVerifier`, singleton perezoso en
   `cognito-verifier.ts`, mismo patrón que `cognito-config.ts` del frontend), configurado con
   `tokenUse: 'access'` — se valida el **Access Token**, no el ID Token, siguiendo
   `doc/security/deployment-security.md §3` del repo raíz. La librería valida firma contra JWKS,
   `iss`, `client_id` y `exp` internamente.
3. Si es válido, adjunta `request.cognitoUser = { sub: payload.sub }` y deja pasar.
4. Si falla, `401 UnauthorizedException`.

**El Access Token no trae email ni nombre** — solo `sub` (y claims técnicos: `client_id`,
`token_use`, `scope`, `exp`). Por eso `CognitoUserClaims` (`cognito-user.decorator.ts`) solo expone
`sub`; cualquier dato de perfil sale de `User`, nunca del token.

Variables de entorno nuevas (`.env`/`.env.template`):

| Variable | Uso |
|---|---|
| `COGNITO_USER_POOL_ID` | ID del User Pool (`<región>_XXXXXXXXX`), para construir la URL de JWKS. |
| `COGNITO_CLIENT_ID` | Debe ser **el mismo valor** que `COGNITO_CLIENT_ID` del `.env` del frontend — mismo App Client. |

No confundir con `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`BCRYPT_SALT_OR_ROUNDS` (también en
`.env.template`): son restos de un módulo de auth local con contraseña propia que fue removido,
sin ninguna relación con Cognito ni con este Guard.

**El Guard se aplica por ruta, no global** (`@UseGuards(CognitoAuthGuard)` en el controller/método
correspondiente) — decisión tomada endpoint por endpoint, no una whitelist inversa. Rutas
protegidas hoy:

| Endpoint | Guard | Usa `@CognitoUser()` |
|---|---|---|
| `POST /ordenes/crear` | Sí | Sí — resuelve el `User` dueño de la orden |
| `POST /consulta/chat` | Sí | No — solo exige sesión, no usa la identidad |
| `GET /ordenes/obtener-estado/:id` | Sí | Sí — valida que la orden pertenezca al usuario del token (ver más abajo) |
| `GET /ordenes` | Sí | Sí — filtra siempre por el usuario del token |
| `POST /auth/perfil`, `PATCH /auth/perfil` | Sí | Sí |
| `POST /webhooks/pago`, `POST /webhooks/ordenes/:id/simular-pago` | **No** | — |

`webhooks/*` queda deliberadamente fuera: los llama la pasarela de pago (o, en el caso simulado,
el frontend sin que medie una sesión de usuario), y necesitan su propia verificación de firma
(`WebhooksService.verifyWebhookSignature`, hoy un stub que siempre pasa — ver
`doc/technical-debt.md`), no una sesión de Cognito.

**Gap de BOLA en `GET /ordenes/obtener-estado/:id` — resuelto**: exigía sesión válida, pero no
validaba que la orden perteneciera al usuario del token (BOLA — Broken Object Level Authorization),
por lo que cualquier usuario logueado que conociera/adivinara el UUID de una orden ajena podía ver
su estado. `OrdersService.getStatus(id, cognitoUser)` ahora resuelve el `User` del token
(`AuthIdentityService.getUserBySub`) y compara `order.userId` contra `user.id`; si no coinciden,
lanza `NotFoundException` — la misma respuesta que si la orden no existiera, para no filtrar cuál de
los dos casos ocurrió. El nuevo `GET /ordenes` (listado de órdenes del usuario autenticado) no tiene
este riesgo porque nunca recibe un id externo: siempre filtra por el usuario del token.

## `AuthIdentityService` (`auth-identity.service.ts`)

Único punto de acceso a `AuthIdentityRepository`/`UserRepository` para todo lo relacionado a
identidad. Cuatro métodos:

- **`syncUser(claims, email)`** — idempotente. Busca `AuthIdentity` por `(provider='COGNITO',
  providerUserId=claims.sub)`. Si existe, devuelve el `User` ya vinculado. Si no existe: busca (o
  crea) un `User` por `email` — esto reutiliza automáticamente un `User` que ya existiera de
  **antes** de este sistema de auth (ej. de una orden creada cuando `ordenes/crear` resolvía por
  email sin ningún login detrás) — y crea la `AuthIdentity` vinculándolo al `sub`. Usado por
  `POST /auth/perfil`.
- **`getUserBySub(claims)`** — lookup estricto, **no crea nada**. Lanza `401` si no hay
  `AuthIdentity` para ese `sub` (significa que el frontend nunca llamó a `syncUser` primero — no
  debería pasar en el flujo normal). Usado por `ordenes/crear` y por `PATCH /auth/perfil`.
- **`isProfileComplete(user)`** — `Boolean(firstName && paternalLastName && gender && dateOfBirth)`.
- **`updateProfile(claims, data)`** — resuelve el `User` con `getUserBySub` y le aplica
  `UserRepository.updateUserById`. Usado por `PATCH /auth/perfil`.

## `AuthController` (`auth.controller.ts`) — `POST`/`PATCH /auth/perfil`

- **`POST /auth/perfil`** — body `{ email }` (el email de la sesión de Cognito del frontend, no
  tecleado por el usuario). Llama `syncUser`. Devuelve el estado actual del perfil, incluido
  `profileComplete: boolean`. El frontend lo llama en dos momentos: al entrar a `consulta/inicio`
  (decide a qué ruta mandar al usuario) y al entrar a `informacion-personal` (para pre-llenar el
  formulario con lo que ya se sabe).
- **`PATCH /auth/perfil`** — body con `firstName`/`paternalLastName`/`gender`/`dateOfBirth`
  (obligatorios) y `rut`/`rutCheckDigit`/`middleName`/`maternalLastName` (opcionales). **Sin
  `email`** — es de solo lectura desde este endpoint, siempre viene de `syncUser`/Cognito, nunca se
  actualiza acá. Llama `updateProfile`. Devuelve el perfil actualizado.

Ambos devuelven el mismo shape (`PerfilResponseDto`), para que el frontend pueda tratarlos igual.

## `ordenes/crear` — ya no crea `User`

Antes de este cambio, `OrdersService.createOrder` resolvía/creaba el `User` por el email del
formulario en el mismo paso que creaba la orden. Ahora:

```ts
const user = await this.authIdentityService.getUserBySub(cognitoUser);
if (!this.authIdentityService.isProfileComplete(user)) {
  throw new BadRequestException('Completa tu información personal antes de generar una orden');
}
```

El `User` **tiene** que existir y estar completo de antemano — si no, la creación de la orden
falla explícitamente en vez de crear/completar el `User` a medias con lo que venga en el body.
`athlete` (deportista) es un campo de `User` (`BOOLEAN NOT NULL DEFAULT false`): se envía en
`PATCH /auth/perfil` (opcional; si no viene se conserva el valor actual) desde el formulario de
`informacion-personal`, y `POST`/`PATCH /auth/perfil` lo devuelven. `ordenes/crear` ya no lo lee
del body, y la generación del plan lo toma de `User`. Un usuario con el perfil completo que se
salta `informacion-personal` conserva la última respuesta que dio.

## Google como Identity Provider — por qué no cambia nada acá

Google está configurado como Identity Provider federado en el User Pool de Cognito (fuera de este
repo, en la consola de AWS). Desde la perspectiva de este backend, **no hay ninguna diferencia**
entre un login nativo (usuario/contraseña de Cognito) y uno vía Google: en ambos casos llega un
Access Token de Cognito con un `sub` estable del User Pool. Por eso `AuthIdentity.provider` **en la
práctica siempre queda `'COGNITO'`**, nunca `'GOOGLE'` — el valor `'GOOGLE'` del tipo `AuthProvider`
existe en el schema pero no se escribe con este diseño (Cognito abstrae la federación). Es un
detalle a tener presente, no un bug.

**Gap conocido, no verificado**: si en Cognito no hay "account linking" configurado, una persona
que se registre primero con usuario/contraseña y después entre con Google usando el mismo email
puede terminar con dos entradas de usuario distintas en el User Pool (dos `sub`), y por lo tanto
dos filas `AuthIdentity`/`User` para la misma persona en esta base de datos. No se puede resolver
solo desde el backend — depende de la configuración del User Pool.

## Verificación manual realizada

Login real (nativo) → `POST /auth/perfil` crea `User`+`AuthIdentity` → `informacion-personal`
completa el perfil vía `PATCH /auth/perfil` → `ordenes/crear` funciona con el perfil ya completo →
una segunda orden con la misma sesión reutiliza el mismo `User`/`AuthIdentity` (no duplica). Login
vía Google no se ejerció todavía contra el User Pool real (integrado en código, pendiente de
probar — ver `nutricionista-virtual-front/doc/auth-pending.md`).
