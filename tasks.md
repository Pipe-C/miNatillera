# tasks.md — miNatillera MVP · Plan 7 días

> Orden de implementación diseñado para tener algo deployable al final de cada día.  
> Convención de estado: `[ ]` pendiente · `[→]` en progreso · `[x]` completado.

---

## Día 1 — Fundación de infraestructura y repositorio

### Objetivo del día
Cuenta AWS lista, repositorio con estructura base, pipeline de deploy funcional aunque vacío.

---

**TASK-01** `[ ]` Configurar cuenta AWS y herramientas locales  
- Verificar que la cuenta está en free tier y que AWS Budgets está disponible.  
- Instalar/actualizar: AWS CLI v2, SAM CLI, Java 21 (Corretto), Maven o Gradle, Node.js (para el frontend).  
- Configurar perfil AWS con permisos de administrador *solo para el setup inicial*; después se usará un rol de despliegue restringido.

**TASK-02** `[ ]` Crear AWS Budget de alerta en USD $1  
- En AWS Budgets crear un "Cost budget" mensual, umbral en $1, notificación por email.  
- Verificar que la alerta aparece en la consola.  
- *Criterio de aceptación*: existe el budget y el email de confirmación fue recibido.

**TASK-03** `[ ]` Inicializar repositorio y estructura de proyecto  
- Crear repositorio Git (GitHub / GitLab / CodeCommit según preferencia).  
- Estructura raíz:
  ```
  /
  ├── backend/          # proyecto Maven Spring Boot
  ├── frontend/         # proyecto Vite + Vanilla JS (o framework ligero)
  ├── infra/            # templates SAM/CloudFormation
  └── docs/             # requirements.md, design.md, tasks.md
  ```
- Agregar `.gitignore` adecuado para Java y Node.

**TASK-04** `[ ]` Crear tabla DynamoDB con capacidad provisionada  
- Usando SAM template o `aws dynamodb create-table` via CLI:  
  - Tabla: `minatillera`  
  - PK: `PK` (String), SK: `SK` (String)  
  - BillingMode: `PROVISIONED`, ReadCapacityUnits: 1, WriteCapacityUnits: 5  
  - TTL habilitado en atributo `ttl`  
- *Criterio de aceptación*: tabla visible en consola con estado ACTIVE.

**TASK-05** `[ ]` Crear parámetros en SSM Parameter Store  
- Parámetros tipo `String` (no SecureString para MVP, ya que no son contraseñas):  
  - `/minatillera/prod/dynamodb/tableName`  
  - `/minatillera/prod/aws/region`  
- *Criterio de aceptación*: `aws ssm get-parameter --name /minatillera/prod/dynamodb/tableName` devuelve el valor correcto.

**TASK-06** `[ ]` Crear rol IAM para la función Lambda  
- Política de confianza: `lambda.amazonaws.com`  
- Permisos inline (principio de mínimo privilegio):  
  - `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:Query` sobre el ARN de la tabla `minatillera`.  
  - `ssm:GetParameter` sobre `arn:aws:ssm:<region>:<account>:parameter/minatillera/prod/*`.  
  - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (para CloudWatch).  
- *Criterio de aceptación*: el rol existe y el policy simulator confirma que Lambda puede hacer GetItem pero NO DeleteTable.

---

## Día 2 — Esqueleto del backend y deploy inicial

### Objetivo del día
Función Lambda desplegada, respondiendo "health check", con SnapStart configurado.

---

**TASK-07** `[ ]` Scaffold del proyecto Spring Boot para Lambda  
- Crear proyecto Maven con dependencias:  
  - `spring-boot-starter-web`  
  - `aws-serverless-java-container-springboot3` (última versión)  
  - `software.amazon.awssdk:dynamodb` (enhanced client)  
  - `software.amazon.awssdk:ssm`  
- Configurar `StreamLambdaHandler` como entry point.  
- Agregar perfil Maven `lambda` que genera un fat JAR con el plugin `maven-shade-plugin`.

**TASK-08** `[ ]` Implementar lectura de configuración desde SSM al arranque  
- Bean `@Configuration` que lee los parámetros SSM en `@PostConstruct`.  
- Si algún parámetro no existe, lanzar excepción descriptiva que aborte el contexto.  
- *Criterio de aceptación*: con parámetros correctos el contexto arranca; con parámetro faltante el log muestra el nombre del parámetro ausente.

**TASK-09** `[ ]` Agregar endpoint `GET /v1/health`  
- Responde `{"status":"UP"}` con HTTP 200. No requiere autenticación.  
- Sirve para verificar que el deploy funciona.

**TASK-10** `[ ]` Escribir SAM template para Lambda + API Gateway  
- Recurso `AWS::Serverless::Function`:  
  - Runtime: `java21`  
  - SnapStart: `ApplyOn: PublishedVersions`  
  - Handler: `com.minatillera.StreamLambdaHandler::handleRequest`  
  - Role: ARN del rol creado en TASK-06  
  - Environment: vacío (config viene de SSM)  
  - AutoPublishAlias: `live`  
- Recurso `AWS::Serverless::HttpApi` con stage `prod`.  
- Recurso `AWS::ApiGatewayV2::Stage` con throttling: `DefaultRouteSettings.ThrottlingBurstLimit: 20`, `ThrottlingRateLimit: 10`.  
- *Criterio de aceptación*: `sam deploy` exitoso, CloudFormation stack en estado CREATE_COMPLETE.

**TASK-11** `[ ]` Verificar SnapStart y alias `live`  
- Comprobar en consola Lambda que la versión publicada tiene SnapStart en estado `Ready`.  
- Verificar que el alias `live` apunta a la versión publicada.  
- Hacer `curl https://<api-id>.execute-api.<region>.amazonaws.com/prod/v1/health` y obtener 200.

---

## Día 3 — Lógica de negocio: Grupos y Miembros

### Objetivo del día
API funcional para crear grupos y agregar/listar miembros, con validaciones y manejo de errores.

---

**TASK-12** `[ ]` Implementar capa de repositorio DynamoDB (grupos)  
- Clase `GroupRepository` con métodos:  
  - `save(Group group)` → `TransactWriteItems` (ítem GROUP#id + ítem INVITE#code)  
  - `findById(String groupId)` → `GetItem`  
  - `findByInviteCode(String code)` → `GetItem(INVITE#code)` + `GetItem(GROUP#id)`  
  - `updateAccumulatedAmount(String groupId, BigDecimal amount, String newStatus)` → `UpdateItem` con condition expression

**TASK-13** `[ ]` Implementar `POST /v1/groups`  
- Validar campos: `name` no vacío, `goalAmount` > 0, `targetDate` futura.  
- Generar `groupId` (UUID v4) y `inviteCode` (8 chars alfanumérico, verificar unicidad en DynamoDB).  
- Persistir con `TransactWriteItems`.  
- Devolver respuesta 201 según contrato de design.md §2.1.

**TASK-14** `[ ]` Implementar middleware de autenticación por código de invitación  
- Filtro o `HandlerInterceptor` de Spring que, para todas las rutas excepto `POST /v1/groups` y `GET /v1/health`, extrae el header `X-Invite-Code`, resuelve el `groupId` y lo inyecta en el request context.  
- Si el código es ausente o inválido → 401 con mensaje genérico (REQ-S-01/02).

**TASK-15** `[ ]` Implementar capa de repositorio DynamoDB (miembros)  
- Clase `MemberRepository` con métodos:  
  - `save(Member member)` → `TransactWriteItems` (ítem MEMBER# + `UpdateItem` contador en METADATA)  
  - `findAllByGroupId(String groupId)` → `Query(PK=GROUP#id, SK begins_with MEMBER#)`

**TASK-16** `[ ]` Implementar `POST /v1/groups/{groupId}/members`  
- Validar código de invitación (TASK-14).  
- Validar nombre (no vacío, ≤60 chars).  
- Verificar que `memberCount < 50`; si no, 409.  
- Persistir y devolver 201 según contrato §2.2.

**TASK-17** `[ ]` Implementar `GET /v1/groups/{groupId}/members`  
- Devolver lista según contrato §2.3.

**TASK-18** `[ ]` Implementar manejador de errores global  
- `@ControllerAdvice` que captura `MethodArgumentNotValidException`, `ConstraintViolationException`, excepciones de dominio propias y errores inesperados.  
- Devuelve siempre el formato de error estándar definido en design.md §2.6.

---

## Día 4 — Lógica de negocio: Aportes y Progreso

### Objetivo del día
API completa de aportes con idempotencia, actualización atómica del acumulado y endpoint de progreso.

---

**TASK-19** `[ ]` Implementar capa de repositorio DynamoDB (aportes e idempotencia)  
- Clase `ContributionRepository` con métodos:  
  - `findIdempotencyResult(String groupId, String key)` → `GetItem(IDEMPOTENCY#groupId#key)`  
  - `saveWithIdempotency(Contribution c, GroupProgress updatedProgress, String idempotencyResponse)` → `TransactWriteItems` (aporte + update acumulado en METADATA + ítem idempotencia con TTL)

**TASK-20** `[ ]` Implementar `POST /v1/groups/{groupId}/contributions`  
- Validar código de invitación, memberId pertenece al grupo, monto > 0, fecha no futura >24 h.  
- Verificar estado del grupo (`ACTIVO`); si `COMPLETADO`, 409.  
- Verificar idempotencia: si `idempotencyKey` ya existe, devolver respuesta almacenada con 200.  
- Registrar aporte y actualizar acumulado de forma atómica.  
- Si acumulado ≥ meta, actualizar estado a `COMPLETADO` en la misma transacción.  
- Devolver respuesta 201 según contrato §2.4.

**TASK-21** `[ ]` Implementar `GET /v1/groups/{groupId}/contributions`  
- Query paginado, ordenado de más reciente a más antiguo.  
- Enriquecer cada ítem con `memberName` (resolver en memoria tras `Query` de miembros, o query adicional).  
- Devolver respuesta según contrato §2.5.

**TASK-22** `[ ]` Implementar `GET /v1/groups/{groupId}/progress`  
- Leer ítem `GROUP#id / METADATA` y calcular `remainingAmount` y `progressPercent`.  
- Calcular `lastContributionDate` con query del aporte más reciente (limit 1, desc).  
- Devolver respuesta según contrato §2.6.

**TASK-23** `[ ]` Pruebas de integración locales con DynamoDB Local  
- Configurar DynamoDB Local (Docker o JAR) para tests de integración.  
- Cubrir flujos: crear grupo → agregar miembro → registrar aporte → verificar progreso.  
- Cubrir idempotencia: registrar el mismo aporte dos veces, verificar que el acumulado no cambia.

---

## Día 5 — Frontend base y conexión con la API

### Objetivo del día
SPA funcional con las vistas principales conectadas a la API real.

---

**TASK-24** `[ ]` Scaffold del frontend  
- Inicializar proyecto Vite (Vanilla JS o framework ligero: Preact / Svelte).  
- Estructura de vistas:  
  - `/` → Home: crear grupo o unirse con código  
  - `/group/:id` → Dashboard: progreso, lista de miembros, historial de aportes  
  - `/group/:id/contribute` → Formulario de aporte  
- Configurar cliente HTTP (`fetch` wrapper) con manejo de `X-Invite-Code` persistido en `localStorage`.

**TASK-25** `[ ]` Implementar vista de creación de grupo  
- Formulario con campos: nombre, monto meta, fecha objetivo.  
- Llamar `POST /v1/groups`, guardar `groupId` e `inviteCode` en `localStorage`.  
- Redirigir al dashboard del grupo.

**TASK-26** `[ ]` Implementar vista "unirse al grupo"  
- Input de código de invitación de 8 caracteres.  
- Llamar `GET /v1/groups/{groupId}/progress` para verificar que el grupo existe.  
- Llamar `POST /v1/groups/{groupId}/members` si el usuario no tiene `memberId` guardado.  
- Guardar `memberId` e `inviteCode` en `localStorage`.

**TASK-27** `[ ]` Implementar dashboard de progreso  
- Anillo (donut chart) con SVG o Canvas, sin librerías externas de charts para mantener el bundle pequeño.  
- Mostrar: monto acumulado, monto faltante, fecha objetivo, estado, `lastContributionDate`.  
- Alerta visual si han pasado >7 días desde `lastContributionDate`.

**TASK-28** `[ ]` Implementar historial de aportes y formulario de nuevo aporte  
- Lista paginada de aportes con nombre del miembro, monto y fecha.  
- Formulario de aporte: miembro, monto, fecha (default hoy).  
- Generar `idempotencyKey` en el cliente (UUID v4) antes de enviar.

---

## Día 6 — APIs Web creativas + PWA + infraestructura de frontend

### Objetivo del día
Integrar las tres APIs creativas requeridas, convertir en PWA e infraestructura S3/CloudFront.

---

**TASK-29** `[ ]` Integrar Web Share API  
- Botón "Compartir invitación" en el dashboard.  
- Si `navigator.share` disponible: `navigator.share({ title, text, url })` con URL conteniendo el código.  
- Fallback: `navigator.clipboard.writeText(url)` + toast "Enlace copiado".

**TASK-30** `[ ]` Integrar Notifications API  
- Al cargar el dashboard, solicitar permiso con `Notification.requestPermission()`.  
- Si se otorga, programar recordatorio 3 días antes de `targetDate` usando `setTimeout` calculado (para MVP; en una PWA real se usaría un Service Worker con `showNotification`).  
- Si han pasado >7 días sin aportes y `status === 'ACTIVO'`, disparar notificación local de recordatorio.

**TASK-31** `[ ]` Integrar Prompt API on-device (Gemini Nano)  
- Detectar disponibilidad: `window.ai && window.ai.languageModel`.  
- Si disponible: crear sesión y hacer prompt con el estado del grupo (porcentaje, días restantes, nombre) para generar un mensaje motivacional de 2-3 líneas.  
- Si no disponible: mostrar frase motivacional estática predefinida (pool de 5 frases rotando por día de la semana).  
- El texto generado o estático se muestra en una card dentro del dashboard.

**TASK-32** `[ ]` Configurar PWA (manifest + Service Worker)  
- `manifest.json` con `name`, `short_name`, `start_url`, `display: standalone`, `icons` (al menos 192x192 y 512x512).  
- Service Worker básico con estrategia cache-first para assets estáticos y network-first para las llamadas a la API.  
- Verificar que Chrome muestra el prompt de instalación.

**TASK-33** `[ ]` Crear infraestructura S3 + CloudFront  
- Bucket S3 `minatillera-frontend-<account-id>` con acceso público bloqueado.  
- Distribución CloudFront:  
  - Origin: S3 con Origin Access Control (OAC).  
  - Default root object: `index.html`.  
  - Error page 404 → `index.html` (para SPA routing).  
  - Response Headers Policy con: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy` básico.  
  - Viewer Protocol Policy: `redirect-to-https`.  
- *Criterio de aceptación*: `https://<cloudfront-domain>/` carga la app.

**TASK-34** `[ ]` Configurar build y deploy del frontend  
- Script `npm run build` genera el directorio `dist/`.  
- Script `npm run deploy` ejecuta `aws s3 sync dist/ s3://<bucket> --delete` y luego `aws cloudfront create-invalidation`.  
- Agregar al `README` el comando de deploy.

---

## Día 7 — Pulido, CORS, seguridad, pruebas e2e y entrega

### Objetivo del día
App completa, probada end-to-end, documentada y publicada.

---

**TASK-35** `[ ]` Configurar CORS en API Gateway y Spring Boot  
- En el SAM template, habilitar CORS en el `HttpApi` con `AllowOrigins: ["https://<cloudfront-domain>"]`, `AllowHeaders: ["content-type", "x-invite-code"]`, `AllowMethods: ["GET","POST","OPTIONS"]`.  
- Agregar `@CrossOrigin` o `WebMvcConfigurer` en Spring Boot como segunda línea de defensa.  
- Verificar con una petición preflight desde el dominio de CloudFront.

**TASK-36** `[ ]` Validar throttling y usage plan  
- Enviar ráfaga de >20 peticiones por segundo contra el endpoint y verificar que API Gateway responde 429 sin invocar Lambda extra.  
- Confirmar en CloudWatch que el número de invocaciones Lambda no creció proporcionalmente.

**TASK-37** `[ ]` Revisión de seguridad de endpoints  
- Confirmar que todos los endpoints salvo `/health` y `POST /groups` requieren `X-Invite-Code`.  
- Probar código de invitación inválido → 401 con mensaje genérico (sin revelar si el grupo existe).  
- Probar inyección básica en campos de texto → verificar que el sistema responde con 400 o sanitiza.

**TASK-38** `[ ]` Pruebas e2e manuales del flujo completo  
- Flujo 1: Crear grupo → compartir código → unirse como miembro → registrar aporte → ver progreso.  
- Flujo 2: Idempotencia — registrar el mismo aporte dos veces con la misma `idempotencyKey` → acumulado no cambia.  
- Flujo 3: Grupo completado — registrar el último aporte que lleva al 100 % → status cambia a COMPLETADO → intento de nuevo aporte devuelve 409.  
- Flujo 4: Web Share / clipboard, Notifications, mensaje motivacional.

**TASK-39** `[ ]` Revisión de accesibilidad (WCAG 2.1 AA)  
- Revisar con Chrome Lighthouse: objetivo ≥ 90 en Accessibility.  
- Verificar: contraste de color suficiente, labels en todos los inputs, navegación por teclado en el formulario de aporte, roles ARIA en el anillo de progreso.

**TASK-40** `[ ]` Optimización de cold start — verificación final  
- Hacer deploy de versión nueva con SnapStart → esperar snapshot `Ready`.  
- Invocar el endpoint `/health` en frío (sin tráfico previo) 5 veces.  
- Medir latencia de las primeras respuestas; documentar que está dentro de parámetros aceptables (<1.5 s con SnapStart).

**TASK-41** `[ ]` Documentación final  
- `README.md` con:  
  - Descripción del proyecto y problema que resuelve.  
  - Arquitectura resumida (texto + enlace a design.md).  
  - Instrucciones de deploy (backend SAM, frontend S3).  
  - Descripción de cómo se usan las tres APIs creativas (Web Share, Notifications, Prompt API).  
- Verificar que `requirements.md`, `design.md` y `tasks.md` están actualizados.

**TASK-42** `[ ]` Entrega final  
- Tag `v1.0.0` en el repositorio.  
- Verificar que la URL de CloudFront está accesible públicamente.  
- Completar el formulario / submission del hackathon con la URL y el repositorio.

---

## Resumen por día

| Día | Foco                                  | Entregable clave                                      |
|-----|---------------------------------------|-------------------------------------------------------|
| 1   | Infraestructura base                  | DynamoDB, SSM, IAM, Budget, repo inicializado         |
| 2   | Lambda + SnapStart + API Gateway      | Endpoint `/health` respondiendo en producción         |
| 3   | API: Grupos y Miembros                | Crear grupo, agregar miembros, autenticación por código |
| 4   | API: Aportes y Progreso               | Aportes idempotentes, progreso en tiempo real         |
| 5   | Frontend base                         | SPA funcional conectada a la API real                 |
| 6   | APIs creativas + PWA + CloudFront     | App instalable con Share, Notifications y Gemini Nano |
| 7   | Pulido, seguridad, pruebas y entrega  | App completa, documentada y publicada                 |
