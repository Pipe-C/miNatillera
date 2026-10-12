# miNatillera

Aplicación web para gestionar natilleras (grupos de ahorro colectivo) de forma digital, transparente y en tiempo real.

**Hackathon:** Código Facilito 2026 - Kiro AI Hackathon

**Demo en vivo:** *no disponible*

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | Spring Boot 3.3 + Java 21 |
| Base de datos | DynamoDB (single-table design) |
| Infraestructura | AWS Lambda (SnapStart) + API Gateway HTTP API + S3 + CloudFront |
| IaC | AWS SAM (`infra/template.yaml`) |
| Desarrollo | Kiro AI como copiloto integral |

---

## Funcionalidades

### Gestión de grupos
- Crear natillera con nombre, meta opcional y fecha objetivo
- Código de invitación de 8 caracteres para compartir
- Monto meta configurable (o sin meta, para acumulación libre)

### Sistema de permisos (sin login)
- **Administrador**: control total — gestiona miembros, aportes, préstamos, co-gestores
- **Co-gestores**: invitados por link de un solo uso (24h), mismos permisos de gestión
- **Invitados**: acceso de solo lectura con el código de invitación
- Revocación real de co-gestores (se elimina el Manager de DynamoDB, detección automática via polling cada 30s)
- Persistencia en localStorage + archivo descargable como respaldo

### Aportes (CRUD completo)
- Registrar, editar y eliminar aportes
- Comprobante adjunto (subida directa a S3 via presigned URL)
- Edición/eliminación recalcula automáticamente el acumulado del grupo
- Filtro por mes, por persona y ordenamiento (fecha/monto)
- Detección automática de aportes pendientes por miembro
- Gráfico de barras mensual (recharts) con selector de año
- Importación masiva desde Excel (.xlsx) con mapeo inteligente de columnas
- Paginación progresiva ("Ver más")

### Préstamos
- Crear préstamos a miembros con validación de saldo disponible
- Registrar pagos parciales
- Estado derivado (Pendiente/Pagado) con badges visuales

### Exportaciones
- Excel (.xlsx): resumen + detalle + pivot por miembro/mes
- Imagen PNG: infografía con progreso, stats, ring, fecha de generación

### Persistencia sin login
- "Retomar tu grupo" — sesión persistente entre visitas (sin borrar caché)
- Logout dual: "Cerrar sesión" (suave, retomable) vs. "Olvidar dispositivo" (borra token)
- Recuperación de acceso con archivo descargado (sin duplicar miembros)

### UX/UI
- Modo claro / oscuro (toggle en header, persistente, sin flash)
- Diseño editorial (tipografía Sora + Geist Sans + Instrument Serif)
- Micro-animaciones (coin burst, stats stagger, card hover, scroll-reveal)
- ProgressRing con glow SVG y count-up animado
- Responsive (mobile-first, 3 breakpoints)
- Frases motivacionales locales (30 frases sobre ahorro/constancia)
- Reloj en vivo en header del dashboard
- Sistema de diálogos unificado con backdrop blur

---

## Ejecución local

### Requisitos
- Node.js 18+
- Java 21+ (Eclipse Adoptium)
- Maven 3.9+
- Docker

### 1. DynamoDB Local

```bash
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local
```

Crear tabla (PowerShell):
```powershell
Invoke-WebRequest -Uri "http://localhost:8000" -Method POST -ContentType "application/x-amz-json-1.0" -Headers @{"X-Amz-Target"="DynamoDB_20120810.CreateTable"; "Authorization"="AWS4-HMAC-SHA256 Credential=fakeLocalKey/20260101/us-east-1/dynamodb/aws4_request, SignedHeaders=host, Signature=fake"} -Body '{"TableName":"minatillera","KeySchema":[{"AttributeName":"PK","KeyType":"HASH"},{"AttributeName":"SK","KeyType":"RANGE"}],"AttributeDefinitions":[{"AttributeName":"PK","AttributeType":"S"},{"AttributeName":"SK","AttributeType":"S"}],"BillingMode":"PAY_PER_REQUEST"}'
```

### 2. Backend

```powershell
cd backend
$env:MINATILLERA_TABLE_NAME="minatillera"
$env:MINATILLERA_REGION="us-east-1"
$env:DYNAMODB_ENDPOINT="http://localhost:8000"
$env:CORS_ALLOWED_ORIGIN="http://localhost:5173"
$env:AWS_ACCESS_KEY_ID="fakeLocalKey"
$env:AWS_SECRET_ACCESS_KEY="fakeLocalSecret"
mvn spring-boot:run
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`

> **Nota:** La subida de comprobantes (imágenes) requiere el bucket S3 real desplegado en AWS. En desarrollo local, el aporte se registra correctamente pero sin la imagen.

---

## Arquitectura

```
backend/
  src/main/java/com/minatillera/
    adapter/in/web/       # Controllers REST
    adapter/out/dynamodb/ # Repositorios DynamoDB
    application/service/  # Casos de uso
    domain/model/         # Entidades (Group, Member, Contribution, Loan, Manager)
    domain/port/          # Interfaces (in/out)
    infrastructure/       # Config (AWS, CORS)

frontend/
  src/
    components/  # UI reutilizable (ProgressRing, MoneyInput, DatePicker, MonthlyChart, etc.)
    views/       # Páginas (Landing, Home, GroupDashboard, Contribute, JoinManager)
    lib/         # Utilidades (api.js, theme, quotes, formatMoney)

infra/
  template.yaml  # SAM (Lambda, API Gateway, DynamoDB, S3, Budget)
```

---

## Uso de AWS

| Servicio | Uso |
|----------|-----|
| Lambda + SnapStart | Backend serverless con cold start optimizado |
| API Gateway HTTP API | Routing + throttling (10 rps / burst 20) |
| DynamoDB | Single-table design, `DeletionPolicy: Retain` |
| S3 | Comprobantes de aportes (presigned PUT + public GET) |
| CloudFront | Frontend estático (SPA routing) |
| SAM | Infrastructure as Code, deploy con un comando |
| Budget | Alerta a $1 USD mensual como red de seguridad |

---

## Uso de Kiro AI

Este proyecto fue desarrollado integralmente con **Kiro AI** como copiloto de desarrollo:

- Iteración rápida de features complejas (hexagonal architecture, presigned URLs, multi-tenant auth sin login)
- Debugging asistido (CORS dual-layer, payload format mismatch Lambda/API GW, S3 content-length signature)
- Diseño de sistemas (single-table DynamoDB, idempotency, token revocation con polling)
- UX/UI editorial con code-generation (Tailwind, CSS animations, recharts)
- Spec-driven development: `requirements.md` → `design.md` → `tasks.md` → implementación

Las decisiones de diseño tomadas durante el desarrollo están documentadas en `.kiro/steering/design-system.md`.

---

## Deploy a producción

Ver `DEPLOY.md` para la guía completa paso a paso.

---

## Documentación adicional

- `requirements.md` — Especificación funcional (formato EARS)
- `design.md` — Modelo de datos y arquitectura
- `tasks.md` — Plan de implementación por día
- `.kiro/steering/design-system.md` — Sistema de diseño (paleta, tipografía, componentes, patrones)
- `DEPLOY.md` — Guía de deploy + checklist pre-producción

---

## Licencia

MIT
