# design.md — miNatillera MVP

---

## 1. Modelo de datos — Amazon DynamoDB

### Decisión de diseño: tabla única (Single-Table Design)

Se usa una sola tabla `minatillera` para maximizar la eficiencia de las 25 RCU/WCU del free tier y evitar el costo fijo mínimo por tabla adicional. Los ítems de distintas entidades conviven usando prefijos en las claves.

---

### Estructura de claves

| Atributo | Tipo   | Descripción                          |
|----------|--------|--------------------------------------|
| `PK`     | String | Partition key — identifica la entidad raíz |
| `SK`     | String | Sort key — sub-entidad o metadato    |

---

### Patrones de acceso y claves por entidad

#### Entidad: Grupo

| Atributo        | Valor ejemplo                              |
|-----------------|--------------------------------------------|
| `PK`            | `GROUP#<groupId>`                          |
| `SK`            | `METADATA`                                 |
| `groupId`       | UUID v4                                    |
| `name`          | "Natillera Navidad 2026"                   |
| `goalAmount`    | "2500000.00" (String, representación exacta) |
| `accumulatedAmount` | "750000.00"                           |
| `targetDate`    | ISO-8601 date: "2026-12-15"                |
| `status`        | `ACTIVO` \| `COMPLETADO`                   |
| `inviteCode`    | "A3F9K2BX" (alfanumérico 8 chars, único)   |
| `memberCount`   | Number                                     |
| `createdAt`     | ISO-8601 datetime                          |
| `updatedAt`     | ISO-8601 datetime                          |

**Accesos soportados directamente:**
- Crear grupo → `PutItem(PK=GROUP#<id>, SK=METADATA)`
- Obtener grupo → `GetItem(PK=GROUP#<id>, SK=METADATA)`

---

#### Entidad: Índice de código de invitación (lookup)

Se necesita resolver `inviteCode → groupId` sin scan. Se logra con un ítem secundario en la misma tabla:

| Atributo    | Valor                        |
|-------------|------------------------------|
| `PK`        | `INVITE#<inviteCode>`        |
| `SK`        | `LOOKUP`                     |
| `groupId`   | UUID del grupo al que apunta |

**GSI — `InviteCodeIndex`:**

| Índice          | PK proyectada | SK proyectada | Proyección        |
|-----------------|---------------|---------------|-------------------|
| *(no requerido; el ítem INVITE# se lee por GetItem directo)* | — | — | — |

> El lookup se hace con `GetItem(PK=INVITE#<code>, SK=LOOKUP)` — O(1), sin GSI, sin costo extra.

---

#### Entidad: Miembro

| Atributo    | Valor ejemplo                        |
|-------------|--------------------------------------|
| `PK`        | `GROUP#<groupId>`                    |
| `SK`        | `MEMBER#<memberId>`                  |
| `memberId`  | UUID v4                              |
| `name`      | "Camilo Torres"                      |
| `joinedAt`  | ISO-8601 datetime                    |

**Accesos soportados:**
- Agregar miembro → `PutItem(PK=GROUP#<id>, SK=MEMBER#<memberId>)`
- Listar miembros de un grupo → `Query(PK=GROUP#<id>, SK begins_with MEMBER#)`

---

#### Entidad: Aporte

| Atributo         | Valor ejemplo                       |
|------------------|-------------------------------------|
| `PK`             | `GROUP#<groupId>`                   |
| `SK`             | `CONTRIBUTION#<isoDatetime>#<contributionId>` |
| `contributionId` | UUID v4                             |
| `memberId`       | UUID del miembro                    |
| `amount`         | "50000.00"                          |
| `date`           | ISO-8601 date                       |
| `idempotencyKey` | String opaco provisto por el cliente |
| `createdAt`      | ISO-8601 datetime                   |

> El `SK` incluye la fecha ISO al inicio para que un `Query` con `SK begins_with CONTRIBUTION#` devuelva los aportes ordenados cronológicamente (DynamoDB ordena lexicográficamente).

**Accesos soportados:**
- Registrar aporte → `PutItem`
- Historial de aportes → `Query(PK=GROUP#<id>, SK begins_with CONTRIBUTION#, ScanIndexForward=false)`

---

#### Entidad: Idempotencia de aportes

| Atributo        | Valor                                 |
|-----------------|---------------------------------------|
| `PK`            | `IDEMPOTENCY#<groupId>#<idempotencyKey>` |
| `SK`            | `RESULT`                              |
| `responseBody`  | JSON serializado de la respuesta original |
| `ttl`           | Epoch unix + 48 h (DynamoDB TTL)      |

> TTL de 48 h limita el almacenamiento. Cubre reintentos de red realistas sin acumular ítems indefinidamente.

---

### Resumen de patrones de acceso

| # | Patrón                              | Operación DynamoDB                                            |
|---|-------------------------------------|---------------------------------------------------------------|
| 1 | Crear grupo                         | `TransactWriteItems` (ítem grupo + ítem invite lookup)        |
| 2 | Obtener grupo por ID                | `GetItem(PK=GROUP#id, SK=METADATA)`                           |
| 3 | Resolver código de invitación       | `GetItem(PK=INVITE#code, SK=LOOKUP)`                          |
| 4 | Agregar miembro                     | `TransactWriteItems` (ítem miembro + `UpdateItem` contador)   |
| 5 | Listar miembros                     | `Query(PK=GROUP#id, SK begins_with MEMBER#)`                  |
| 6 | Registrar aporte (idempotente)      | `GetItem` idempotencia → si existe, devolver; si no, `TransactWriteItems` (aporte + actualizar acumulado + idempotencia) |
| 7 | Historial de aportes                | `Query(PK=GROUP#id, SK begins_with CONTRIBUTION#, desc)`      |
| 8 | Progreso del grupo                  | `GetItem(PK=GROUP#id, SK=METADATA)` (campos ya actualizados)  |

---

## 2. Contratos de endpoints

Base URL: `https://api.<dominio>/v1`

Autenticación: header `X-Invite-Code: <code>` en todos los endpoints excepto `POST /groups`.

Formato: `Content-Type: application/json` en todas las peticiones y respuestas.

---

### 2.1 `POST /groups` — Crear grupo

**Request body**
```json
{
  "name": "Natillera Navidad 2026",
  "goalAmount": "2500000.00",
  "targetDate": "2026-12-15"
}
```

**Response 201**
```json
{
  "groupId": "a1b2c3d4-...",
  "inviteCode": "A3F9K2BX",
  "name": "Natillera Navidad 2026",
  "goalAmount": "2500000.00",
  "targetDate": "2026-12-15",
  "status": "ACTIVO",
  "createdAt": "2026-07-20T14:00:00Z"
}
```

**Errores**

| Código | Condición                              |
|--------|----------------------------------------|
| 400    | Falta campo requerido / valor inválido |

---

### 2.2 `POST /groups/{groupId}/members` — Agregar miembro

Header requerido: `X-Invite-Code`

**Request body**
```json
{
  "name": "Camilo Torres"
}
```

**Response 201**
```json
{
  "memberId": "e5f6g7h8-...",
  "name": "Camilo Torres",
  "groupId": "a1b2c3d4-...",
  "joinedAt": "2026-07-20T14:05:00Z"
}
```

**Errores**

| Código | Condición                                     |
|--------|-----------------------------------------------|
| 400    | Nombre vacío o supera 60 caracteres           |
| 401    | Código de invitación ausente o inválido       |
| 404    | Grupo no encontrado (mismo mensaje que 401)   |
| 409    | Grupo ya tiene 50 miembros                    |

---

### 2.3 `GET /groups/{groupId}/members` — Listar miembros

Header requerido: `X-Invite-Code`

**Response 200**
```json
{
  "groupId": "a1b2c3d4-...",
  "members": [
    { "memberId": "e5f6g7h8-...", "name": "Camilo Torres", "joinedAt": "2026-07-20T14:05:00Z" }
  ]
}
```

---

### 2.4 `POST /groups/{groupId}/contributions` — Registrar aporte

Header requerido: `X-Invite-Code`

**Request body**
```json
{
  "memberId": "e5f6g7h8-...",
  "amount": "50000.00",
  "date": "2026-07-20",
  "idempotencyKey": "client-generated-uuid"
}
```

**Response 201** (o 200 si idempotente)
```json
{
  "contributionId": "i9j0k1l2-...",
  "memberId": "e5f6g7h8-...",
  "amount": "50000.00",
  "date": "2026-07-20",
  "group": {
    "groupId": "a1b2c3d4-...",
    "accumulatedAmount": "800000.00",
    "goalAmount": "2500000.00",
    "status": "ACTIVO",
    "progressPercent": 32
  }
}
```

**Errores**

| Código | Condición                                       |
|--------|-------------------------------------------------|
| 400    | Monto ≤ 0 / fecha futura >24 h / campo faltante |
| 401    | Código de invitación ausente o inválido         |
| 404    | Grupo o miembro no encontrado                   |
| 409    | Grupo en estado `COMPLETADO`                    |

---

### 2.5 `GET /groups/{groupId}/contributions` — Historial de aportes

Header requerido: `X-Invite-Code`

Query params opcionales: `limit` (default 50, max 100), `lastKey` (para paginación).

**Response 200**
```json
{
  "groupId": "a1b2c3d4-...",
  "contributions": [
    {
      "contributionId": "i9j0k1l2-...",
      "memberId": "e5f6g7h8-...",
      "memberName": "Camilo Torres",
      "amount": "50000.00",
      "date": "2026-07-20",
      "createdAt": "2026-07-20T15:00:00Z"
    }
  ],
  "nextKey": null
}
```

---

### 2.6 `GET /groups/{groupId}/progress` — Progreso del grupo

Header requerido: `X-Invite-Code`

**Response 200**
```json
{
  "groupId": "a1b2c3d4-...",
  "name": "Natillera Navidad 2026",
  "goalAmount": "2500000.00",
  "accumulatedAmount": "800000.00",
  "remainingAmount": "1700000.00",
  "progressPercent": 32,
  "targetDate": "2026-12-15",
  "status": "ACTIVO",
  "memberCount": 5,
  "lastContributionDate": "2026-07-20"
}
```

---

### Formato de error estándar

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo 'goalAmount' debe ser mayor a cero."
  }
}
```

Códigos de error de aplicación: `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## 3. Arquitectura del sistema

### 3.1 Diagrama lógico (descripción textual)

```
Usuario (navegador)
       │
       │  HTTPS
       ▼
┌─────────────────────────────────┐
│        Amazon CloudFront        │  CDN global, HTTPS forzado,
│   (distribución del frontend)   │  headers de seguridad via
│                                 │  Response Headers Policy
└────────────┬────────────────────┘
             │  Origin: S3 (OAC)
             ▼
      ┌─────────────┐
      │  Amazon S3  │  Archivos estáticos (HTML/CSS/JS/manifest)
      │  (privado)  │  acceso solo desde CloudFront via OAC
      └─────────────┘

Usuario (navegador) — llamadas a la API
       │
       │  HTTPS + X-Invite-Code
       ▼
┌──────────────────────────────────────────┐
│     Amazon API Gateway (HTTP API)        │
│  Usage Plan: throttle 10 rps / burst 20  │
│  Rutas: ANY /v1/{proxy+}                 │
└──────────────┬───────────────────────────┘
               │  Lambda Proxy Integration
               ▼
┌──────────────────────────────────────────────────────────┐
│  AWS Lambda — Java 21 + Spring Boot                      │
│  Handler: aws-serverless-java-container (RequestHandler) │
│  SnapStart: PublishedVersions                            │
│  Memory: 512 MB  |  Timeout: 15 s                        │
│  Alias: live → versión publicada con SnapStart           │
└───────┬──────────────────────────────────┬───────────────┘
        │                                  │
        │  SDK v2 (async client)           │  SDK v2
        ▼                                  ▼
┌─────────────────┐              ┌─────────────────────────┐
│  Amazon DynamoDB│              │  AWS SSM Parameter Store │
│  Tabla única:   │              │  /minatillera/prod/*     │
│  minatillera    │              │  (tier estándar, gratis) │
│  1 RCU / 5 WCU  │              └─────────────────────────┘
└─────────────────┘

┌─────────────────────────────────┐
│  AWS Budgets                    │
│  Alerta a USD $1 → email admin  │
└─────────────────────────────────┘
```

---

### 3.2 Flujo de una petición de API

1. El navegador envía `POST /v1/groups/{id}/contributions` con `X-Invite-Code`.
2. **API Gateway** valida el throttle del usage plan; si excede, responde 429 directamente sin invocar Lambda.
3. **Lambda** (alias `live`) arranca desde el snapshot de SnapStart (no JVM fría).
4. Spring Boot recibe la petición a través de `aws-serverless-java-container`; el contexto de Spring ya está inicializado en el snapshot.
5. El handler valida el código de invitación contra DynamoDB (`GetItem INVITE#code`).
6. Ejecuta la lógica de negocio con `TransactWriteItems` (aporte + actualización del acumulado).
7. Responde JSON al API Gateway, que lo retorna al cliente.

---

### 3.3 Mitigación de cold start con SnapStart

| Problema                     | Solución                                                                                   |
|------------------------------|--------------------------------------------------------------------------------------------|
| JVM cold start en Lambda Java (~3-8 s) | SnapStart captura un snapshot del proceso ya iniciado (JVM + Spring context cargado) al publicar la versión |
| Restauración del snapshot puede tener estado stale | Implementar `CRaC` hooks (`beforeCheckpoint` / `afterRestore`) para cerrar y reabrir conexiones SDK y limpiar cachés de hora |
| SnapStart solo aplica a versiones publicadas | El alias `live` apunta siempre a la versión publicada más reciente; el API Gateway integra contra el alias |
| Aleatoriedad y unicidad post-restore | Usar `SecureRandom` con re-seed en `afterRestore`; no cachear UUIDs generados pre-snapshot |

**Configuración requerida en `template.yaml` / CloudFormation:**
```
SnapStart:
  ApplyOn: PublishedVersions
```
Con la versión publicada y el alias, cada deploy crea un nuevo snapshot automáticamente.

---

### 3.4 Decisiones de diseño clave

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| HTTP API Gateway (no REST API) | REST API | HTTP API cuesta ~70 % menos; las features de REST API (API Keys nativas, WAF integrado) no son necesarias en MVP |
| DynamoDB provisionado 1/5 RCU/WCU | On-demand | On-demand no cubre Always Free; provisionado fijo garantiza costo $0 dentro del límite |
| Tabla única DynamoDB | Tabla por entidad | Minimiza costo fijo; simplifica los patrones de acceso conocidos |
| Montos como String en DynamoDB | Number nativo | Evita pérdida de precisión decimal en serialización/deserialización; BigDecimal en Java ↔ String en Dynamo |
| SSM Parameter Store estándar | Secrets Manager | Parameter Store estándar es gratuito; Secrets Manager tiene costo por secreto/mes |
| CloudFront + S3 con OAC | S3 website hosting público | OAC mantiene el bucket privado; CloudFront fuerza HTTPS y permite añadir headers de seguridad |
| Idempotencia en DynamoDB con TTL | Sin idempotencia | Protege contra doble-click y reintentos de red sin complicar la arquitectura |
