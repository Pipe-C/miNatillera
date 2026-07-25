# DEPLOY.md — miNatillera Backend

Guía paso a paso para desplegar el backend serverless de miNatillera.

---

## Ejecución local rápida (desarrollo / demo)

Esta es la forma más rápida de correr el proyecto completo en tu máquina local.

### Requisitos para desarrollo local

| Herramienta | Versión | Para qué |
|-------------|---------|----------|
| Node.js | 18+ | Frontend (Vite + React) |
| Java | 21+ | Backend (Spring Boot) |
| Maven | 3.9+ | Compilar el backend |
| Docker | Cualquiera | DynamoDB Local |

### Paso 1 — Levantar DynamoDB Local (base de datos)

```bash
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local
```

Crear la tabla:
```bash
aws dynamodb create-table \
  --endpoint-url http://localhost:8000 \
  --table-name minatillera \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 \
  --no-cli-pager
```

> Si no tenés AWS CLI instalado, podés crear la tabla con el script Java de verificación (ver paso 3).

### Paso 2 — Levantar el backend (API)

Abrir una terminal:

```bash
cd backend

# Variables de entorno para desarrollo local (sin AWS real)
set MINATILLERA_TABLE_NAME=minatillera
set MINATILLERA_REGION=us-east-1
set DYNAMODB_ENDPOINT=http://localhost:8000
set CORS_ALLOWED_ORIGIN=http://localhost:5173

# Compilar y ejecutar
mvn clean compile
mvn spring-boot:run
```

> En Linux/Mac, usá `export` en vez de `set`.

La API estará disponible en: **http://localhost:8080/v1/health**

Verificar:
```bash
curl http://localhost:8080/v1/health
# Respuesta: {"status":"UP"}
```

### Paso 3 — Levantar el frontend (UI)

Abrir una SEGUNDA terminal:

```bash
cd frontend
npm install        # solo la primera vez
npm run dev
```

La app estará disponible en: **http://localhost:5173**

> El frontend ya está configurado para apuntar a `http://localhost:8080/v1` en desarrollo (archivo `.env`).

### Paso 4 — Usar la app

1. Abrir http://localhost:5173 en el navegador
2. Click en "Ingresar a la demo"
3. Crear un grupo (nombre, monto, fecha)
4. Copiar el código de invitación generado
5. Agregar miembros
6. Registrar aportes
7. Ver el progreso en el dashboard

> **Nota sobre comprobantes:** La subida de comprobantes (imágenes adjuntas a
> aportes) requiere el bucket S3 real desplegado en AWS. En desarrollo local
> con credenciales dummy (`fakeLocalKey`), este flujo no puede probarse de
> punta a punta — el aporte se registra correctamente pero sin la imagen.
> Para probar la subida completa, desplegá primero con `sam deploy` (ver
> sección de producción más abajo).

### Resumen de puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Spring Boot) | 8080 | http://localhost:8080 |
| DynamoDB Local | 8000 | http://localhost:8000 |

### Detener todo

```bash
# Frontend: Ctrl+C en su terminal
# Backend: Ctrl+C en su terminal
# DynamoDB: 
docker stop dynamodb-local
docker rm dynamodb-local
```

---

## Deploy a producción (AWS)

Las secciones siguientes cubren el despliegue completo a AWS (Lambda + API Gateway + DynamoDB + S3 + CloudFront). Solo necesario para producción, no para desarrollo local.

---

## Requisitos previos

| Herramienta       | Versión mínima | Instalación                          |
|-------------------|----------------|--------------------------------------|
| AWS CLI           | 2.x            | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| AWS SAM CLI       | 1.100+         | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| Java (Corretto)   | 21             | https://docs.aws.amazon.com/corretto/latest/corretto-21-ug/downloads-list.html |
| Apache Maven      | 3.9+           | https://maven.apache.org/install.html |

Verificar:
```bash
aws --version
sam --version
java -version
mvn -version
```

---

## 1. Configurar credenciales AWS

```bash
aws configure
# Ingresar: Access Key, Secret Key, región (ej. us-east-1), formato json
```

> La cuenta debe estar en el free tier. No se requiere ninguna credencial estática en el código — Lambda usa el rol de ejecución configurado en el template.

---

## 2. Compilar el backend

```bash
cd backend
mvn clean package -Plambda -DskipTests
```

El JAR resultante queda en `backend/target/minatillera-backend-1.0.0.jar`.

---

## 3. Desplegar con SAM

```bash
cd infra

sam deploy \
  --guided \
  --template-file template.yaml \
  --stack-name minatillera-stack \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Stage=prod \
    AlertEmail=tu-email@ejemplo.com \
    FrontendDomain=tu-distribucion.cloudfront.net
```

### Primera vez (`--guided`)

SAM pedirá confirmación de parámetros y guardará la configuración en `samconfig.toml`.
Los despliegues subsiguientes solo requieren:

```bash
sam deploy
```

### Verificar el deploy

```bash
# La URL de la API aparece en los Outputs del stack
aws cloudformation describe-stacks \
  --stack-name minatillera-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

Probar el health check:
```bash
curl https://<api-id>.execute-api.<region>.amazonaws.com/prod/v1/health
# Respuesta esperada: {"status":"UP"}
```

---

## 4. Verificar SnapStart

Tras el deploy, verificar que el snapshot está listo:

```bash
aws lambda get-function \
  --function-name minatillera-api \
  --query "Configuration.SnapStart"
# Esperar: {"ApplyOn": "PublishedVersions", "OptimizationStatus": "On"}
```

Verificar el alias `live`:
```bash
aws lambda get-alias \
  --function-name minatillera-api \
  --name live
```

---

## 5. Configurar AWS Budget (alerta en $1 USD)

El template SAM ya incluye un recurso `AWS::Budgets::Budget` que crea automáticamente:
- Un presupuesto mensual de $1 USD
- Notificación al 80% ($0.80)
- Notificación al 100% ($1.00)

Si prefieres crearlo manualmente (o si el deploy no incluye Budgets):

### Via consola AWS
1. Ir a **AWS Budgets** → **Create budget**
2. Seleccionar **Cost budget - Recommended**
3. Budget amount: **$1.00** / Monthly
4. Alert threshold: **80%** y **100%**
5. Email: tu correo personal
6. Crear

### Via CLI
```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "minatillera-monthly-1usd",
    "BudgetType": "COST",
    "TimeUnit": "MONTHLY",
    "BudgetLimit": {"Amount": "1", "Unit": "USD"}
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {"SubscriptionType": "EMAIL", "Address": "tu-email@ejemplo.com"}
      ]
    }
  ]'
```

---

## 6. Verificar throttling

El HTTP API Gateway está configurado con:
- **Rate limit**: 10 requests/segundo
- **Burst**: 20 requests

Esto protege contra picos accidentales o loops. Si API Gateway recibe más de 20 rps, responde `429 Too Many Requests` sin invocar Lambda.

Para verificar:
```bash
# Enviar una ráfaga (requiere herramienta como hey o ab)
hey -n 50 -c 30 -H "X-Invite-Code: TESTCODE" \
  https://<api-url>/prod/v1/health
# Verificar que algunas respuestas son 429
```

---

## 7. Actualizar el deploy

Tras cambios en el código:
```bash
cd backend && mvn clean package -Plambda -DskipTests
cd ../infra && sam deploy
```

SAM publicará una nueva versión de Lambda y SnapStart creará un nuevo snapshot automáticamente.

---

## 8. Desarrollo local

Para correr la API localmente contra DynamoDB Local:

### Iniciar DynamoDB Local (Docker)
```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

### Crear la tabla localmente
```bash
aws dynamodb create-table \
  --endpoint-url http://localhost:8000 \
  --table-name minatillera \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

### Variables de entorno para desarrollo
```bash
export MINATILLERA_TABLE_NAME=minatillera
export MINATILLERA_REGION=us-east-1
export DYNAMODB_ENDPOINT=http://localhost:8000
```

### Ejecutar la app con Spring Boot (sin Lambda)
```bash
cd backend
mvn spring-boot:run
```
La API estará disponible en `http://localhost:8080/v1/health`.

### Verificación manual de idempotencia

Un script standalone en `scripts/verification/IdempotencyManualCheck.java` ejecuta
el flujo completo de idempotencia contra DynamoDB Local (crear grupo → miembro →
aporte × 2 con misma key → verificar que solo se guardó una vez):

```bash
cd backend
mvn test-compile exec:java \
  -Dexec.mainClass=com.minatillera.IdempotencyManualCheck \
  -Dexec.classpathScope=test
```

---

## 9. Eliminación del stack

```bash
sam delete --stack-name minatillera-stack
```

> **Importante:** La tabla DynamoDB tiene `DeletionPolicy: Retain` — un
> `sam delete` elimina Lambda, API Gateway, S3 y demás recursos, pero NO
> borra la tabla ni sus datos. Si en algún momento querés eliminarla de
> verdad, hacelo manualmente:
>
> ```bash
> aws dynamodb delete-table --table-name minatillera
> ```

---

## 10. Frontend — Build y deploy a S3 + CloudFront

### Build de producción

```bash
cd frontend

# Configurar la URL de la API en .env.production
# (ya definido: VITE_API_BASE_URL=https://YOUR_API_GATEWAY_URL/prod/v1)

npm run build
```

El directorio `dist/` contendrá los archivos estáticos optimizados.

### Crear bucket S3 (primera vez)

```bash
aws s3 mb s3://minatillera-frontend-<ACCOUNT_ID> --region us-east-1
aws s3api put-public-access-block \
  --bucket minatillera-frontend-<ACCOUNT_ID> \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Subir archivos

```bash
aws s3 sync dist/ s3://minatillera-frontend-<ACCOUNT_ID> --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" --exclude "sw.js" --exclude "manifest.json"

# index.html, sw.js y manifest no deben cachearse agresivamente
aws s3 cp dist/index.html s3://minatillera-frontend-<ACCOUNT_ID>/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
aws s3 cp dist/sw.js s3://minatillera-frontend-<ACCOUNT_ID>/sw.js \
  --cache-control "no-cache, no-store, must-revalidate"
aws s3 cp dist/manifest.json s3://minatillera-frontend-<ACCOUNT_ID>/manifest.json \
  --cache-control "no-cache"
```

### Invalidar caché de CloudFront

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

### Script de deploy (automatizado)

Agregar al `package.json` del frontend:

```json
{
  "scripts": {
    "deploy": "npm run build && aws s3 sync dist/ s3://minatillera-frontend-ACCOUNT_ID --delete && aws cloudfront create-invalidation --distribution-id DIST_ID --paths '/*'"
  }
}
```

### CloudFront — configuración requerida

- **Origin**: bucket S3 con Origin Access Control (OAC)
- **Default root object**: `index.html`
- **Error pages**: 403 y 404 → `/index.html` con código 200 (SPA routing)
- **Viewer Protocol Policy**: redirect-to-https
- **Response Headers Policy**: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`

---

## Estructura de costos esperada (free tier)

| Servicio         | Uso estimado MVP         | Costo      |
|------------------|--------------------------|------------|
| Lambda           | < 1M invocaciones/mes    | $0.00      |
| API Gateway HTTP | < 1M requests/mes        | $0.00      |
| DynamoDB         | 5 RCU / 5 WCU (< 25)    | $0.00      |
| SSM Parameter    | Tier estándar            | $0.00      |
| CloudWatch Logs  | < 5 GB                   | $0.00      |
| **Total**        |                          | **$0.00**  |

El budget de $1 es una red de seguridad. Si todo está configurado correctamente, no debería activarse.

---

## Checklist pre-deploy (ejecutar manualmente)

Orden secuencial. No saltar pasos.

### 1. Verificar cuenta AWS

```bash
aws configure
aws sts get-caller-identity
```

Confirmar que la cuenta está activa y dentro del free tier (verificar en la consola AWS → Billing → Free Tier Usage).

### 2. Build del backend (perfil Lambda)

```bash
cd backend
mvn clean package -Plambda -DskipTests
```

Verificar que genera `backend/target/minatillera-backend-1.0.0.jar`.

### 3. Deploy con SAM

```bash
cd infra
sam build
sam deploy --guided --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides Stage=prod AlertEmail=TU_EMAIL FrontendDomain=TU_DOMINIO_CLOUDFRONT
```

Primera vez: responder las preguntas interactivas. Guardar en `samconfig.toml` para futuros deploys.

### 4. Verificar recursos creados

```bash
# API Gateway URL
aws cloudformation describe-stacks --stack-name minatillera-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# Bucket de comprobantes
aws cloudformation describe-stacks --stack-name minatillera-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ReceiptsBucketName'].OutputValue" --output text

# Health check
curl https://<API_URL>/v1/health
```

### 5. Configurar el frontend para producción

Editar `frontend/.env.production`:
```
VITE_API_BASE_URL=https://<API_ID>.execute-api.<REGION>.amazonaws.com/prod/v1
```

### 6. Build y deploy del frontend

```bash
cd frontend
npm run build

# Crear bucket S3 (primera vez)
aws s3 mb s3://minatillera-frontend-<ACCOUNT_ID> --region us-east-1

# Subir assets estáticos con cache largo
aws s3 sync dist/ s3://minatillera-frontend-<ACCOUNT_ID> --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" --exclude "manifest.json"

# index.html sin cache
aws s3 cp dist/index.html s3://minatillera-frontend-<ACCOUNT_ID>/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
aws s3 cp dist/manifest.json s3://minatillera-frontend-<ACCOUNT_ID>/manifest.json \
  --cache-control "no-cache"
```

### 7. Crear/configurar CloudFront

- Origin: bucket S3 con OAC
- Default root object: `index.html`
- Error pages: 403/404 → `/index.html` (200) para SPA routing
- HTTPS only

Invalidar caché:
```bash
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

### 8. Prueba de humo end-to-end

```bash
# 1. Health check
curl https://<API_URL>/v1/health

# 2. Crear grupo
curl -X POST https://<API_URL>/v1/groups \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Prod","goalAmount":100000,"targetDate":"2027-06-01","creatorName":"Admin"}'

# 3. Verificar que el frontend carga (sin errores en consola)
# Abrir https://<CLOUDFRONT_DOMAIN> en el navegador

# 4. Crear grupo desde UI → agregar miembro → registrar aporte con comprobante
# Verificar que la imagen del comprobante carga desde S3 (no localStorage)
```

### 9. Confirmar AWS Budget

```bash
aws budgets describe-budgets --account-id $(aws sts get-caller-identity --query Account --output text)
```

Verificar:
- Presupuesto: $1 USD mensual
- Alertas configuradas al 80% y 100%
- Email de notificación correcto

### 10. Actualizar CORS con dominio real

Una vez que tengas el dominio de CloudFront:

```bash
# Re-deploy con el dominio correcto
cd infra
sam deploy --parameter-overrides Stage=prod AlertEmail=TU_EMAIL FrontendDomain=d1234abcdef.cloudfront.net
```

Esto actualiza tanto el API Gateway CORS como la variable de entorno `CORS_ALLOWED_ORIGIN` del Lambda.
