# requirements.md — miNatillera MVP

> Notación EARS (Easy Approach to Requirements Syntax).  
> Grupos: Dominio · Seguridad · Infraestructura · Frontend / APIs Web

---

## 1. Dominio

### 1.1 Grupos de ahorro

**REQ-D-01** (Ubicuo)  
EL SISTEMA DEBERÁ almacenar todo monto monetario como número de punto fijo con exactamente dos decimales, sin usar tipos de coma flotante.

**REQ-D-02** (Ubicuo)  
EL SISTEMA DEBERÁ asignar a cada grupo un identificador único (UUID v4) en el momento de su creación.

**REQ-D-03** (Ubicuo)  
EL SISTEMA DEBERÁ generar automáticamente un código de invitación alfanumérico de 8 caracteres, único por grupo, en el momento de su creación.

**REQ-D-04** (Event-driven)  
CUANDO un usuario crea un grupo de ahorro con nombre, monto meta y fecha objetivo, EL SISTEMA DEBERÁ persistir el grupo con estado `ACTIVO` y devolver el `groupId` y el código de invitación generados.

**REQ-D-05** (Unwanted behavior)  
SI el monto meta proporcionado al crear un grupo es menor o igual a cero, ENTONCES EL SISTEMA DEBERÁ rechazar la petición con un error de validación 400, sin crear ningún registro.

**REQ-D-06** (Unwanted behavior)  
SI la fecha objetivo proporcionada al crear un grupo es anterior o igual a la fecha actual del servidor, ENTONCES EL SISTEMA DEBERÁ rechazar la petición con un error de validación 400.

**REQ-D-07** (Event-driven)  
CUANDO un usuario registra un aporte Y el monto acumulado del grupo alcanza o supera la meta por primera vez, EL SISTEMA DEBERÁ actualizar el estado del grupo a `COMPLETADO` de forma atómica junto con el registro del aporte.

**REQ-D-08** (State-driven)  
MIENTRAS un grupo tenga estado `COMPLETADO`, EL SISTEMA DEBERÁ rechazar cualquier intento de registrar nuevos aportes con un error 409.

### 1.2 Miembros

**REQ-D-09** (Event-driven)  
CUANDO un usuario se une a un grupo mediante un código de invitación válido y proporciona un nombre de miembro, EL SISTEMA DEBERÁ crear el miembro asociado al grupo y devolver un `memberId` persistente.

**REQ-D-10** (Unwanted behavior)  
SI el nombre de miembro enviado está vacío o supera los 60 caracteres, ENTONCES EL SISTEMA DEBERÁ rechazar la petición con un error de validación 400.

**REQ-D-11** (Ubicuo)  
EL SISTEMA DEBERÁ permitir que un mismo grupo tenga hasta 50 miembros activos.

**REQ-D-12** (Unwanted behavior)  
SI un grupo ya tiene 50 miembros, ENTONCES EL SISTEMA DEBERÁ rechazar el intento de agregar un nuevo miembro con error 409, sin crear registros parciales.

### 1.3 Aportes

**REQ-D-13** (Event-driven)  
CUANDO un miembro registra un aporte con monto y fecha, EL SISTEMA DEBERÁ persistir el aporte, actualizar el monto acumulado del grupo de forma atómica y devolver el estado actualizado del grupo.

**REQ-D-14** (Event-driven)  
CUANDO un usuario registra un aporte con una `idempotencyKey` ya utilizada dentro del mismo grupo, EL SISTEMA DEBERÁ devolver la respuesta original almacenada sin duplicar el registro ni actualizar el acumulado.

**REQ-D-15** (Unwanted behavior)  
SI el monto de un aporte es menor o igual a cero, ENTONCES EL SISTEMA DEBERÁ rechazar la petición con error de validación 400.

**REQ-D-16** (Unwanted behavior)  
SI la fecha de un aporte es posterior en más de 24 horas a la fecha y hora actual del servidor, ENTONCES EL SISTEMA DEBERÁ rechazar la petición con error de validación 400.

**REQ-D-17** (Ubicuo)  
EL SISTEMA DEBERÁ ordenar el historial de aportes de un grupo de más reciente a más antiguo cuando sea consultado.

### 1.4 Progreso

**REQ-D-18** (State-driven)  
MIENTRAS un grupo no haya alcanzado su monto meta, EL SISTEMA DEBERÁ exponer en la consulta de progreso: monto acumulado, monto faltante, porcentaje de avance (0–99 %) y estado `ACTIVO`.

**REQ-D-19** (State-driven)  
MIENTRAS un grupo tenga estado `COMPLETADO`, EL SISTEMA DEBERÁ exponer porcentaje de avance igual a 100 % en la consulta de progreso.

---

## 2. Seguridad

**REQ-S-01** (Unwanted behavior)  
SI una petición que requiere código de invitación no incluye ese código, ENTONCES EL SISTEMA DEBERÁ rechazarla con HTTP 401 y un mensaje genérico, sin revelar si el grupo existe o no.

**REQ-S-02** (Unwanted behavior)  
SI una petición incluye un código de invitación que no corresponde a ningún grupo, ENTONCES EL SISTEMA DEBERÁ responder con HTTP 401 y el mismo mensaje genérico de REQ-S-01.

**REQ-S-03** (Ubicuo)  
EL SISTEMA DEBERÁ validar y sanear todas las entradas de texto contra inyección antes de persistirlas o procesarlas.

**REQ-S-04** (Ubicuo)  
EL SISTEMA DEBERÁ comunicarse con los clientes únicamente a través de HTTPS. Las URLs HTTP deberán redirigirse a HTTPS en la capa de CloudFront.

**REQ-S-05** (Ubicuo)  
EL SISTEMA DEBERÁ incluir las cabeceras de seguridad HTTP mínimas (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`) en todas las respuestas del frontend servido por CloudFront.

**REQ-S-06** (Unwanted behavior)  
SI una petición a la API supera el límite de throttling configurado en el usage plan de API Gateway, ENTONCES EL SISTEMA DEBERÁ responder con HTTP 429, sin incurrir en costo adicional por exceso de invocaciones Lambda.

**REQ-S-07** (Ubicuo)  
EL SISTEMA DEBERÁ leer todos los valores de configuración sensibles (tabla DynamoDB, región, etc.) desde AWS Systems Manager Parameter Store al inicio de la función Lambda, sin embeber esos valores en el código fuente ni en variables de entorno en texto plano.

---

## 3. Infraestructura

**REQ-I-01** (Ubicuo)  
EL SISTEMA DEBERÁ ejecutar la lógica de negocio en una función AWS Lambda con runtime Java 21 y SnapStart habilitado, para reducir la latencia de cold start.

**REQ-I-02** (Ubicuo)  
EL SISTEMA DEBERÁ exponer la API únicamente a través de un HTTP API de Amazon API Gateway (no REST API), enrutando todas las rutas a la función Lambda.

**REQ-I-03** (Ubicuo)  
EL SISTEMA DEBERÁ usar Amazon DynamoDB en modo de capacidad provisionada con exactamente 1 RCU y 1 WCU por tabla en entorno de desarrollo, y no más de 5 RCU / 5 WCU en producción, manteniéndose dentro del límite Always Free de 25 RCU / 25 WCU.

**REQ-I-04** (Ubicuo)  
EL SISTEMA DEBERÁ tener configurado un AWS Budget con umbral de alerta por correo electrónico al alcanzar USD $1 en costos estimados del mes en curso.

**REQ-I-05** (Event-driven)  
CUANDO el costo estimado mensual supere USD $1, EL SISTEMA DEBERÁ enviar una notificación automática al correo del administrador mediante AWS Budgets.

**REQ-I-06** (Ubicuo)  
EL SISTEMA DEBERÁ servir el frontend como sitio estático desde Amazon S3 (acceso bloqueado públicamente) distribuido a través de Amazon CloudFront con Origin Access Control.

**REQ-I-07** (Ubicuo)  
EL SISTEMA DEBERÁ mantener separación de roles IAM mínimos: la función Lambda tendrá permisos únicamente de `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:Query` sobre las tablas que le corresponden; y de `ssm:GetParameter` sobre los parámetros de su namespace.

**REQ-I-08** (Unwanted behavior)  
SI la función Lambda no puede leer un parámetro de configuración en SSM Parameter Store al arrancar, ENTONCES EL SISTEMA DEBERÁ fallar de forma rápida con un log de error descriptivo, sin continuar con configuración indefinida.

---

## 4. Frontend / APIs Web

**REQ-F-01** (Ubicuo)  
EL SISTEMA DEBERÁ ser una Progressive Web App (PWA) con un archivo `manifest.json` y un Service Worker registrado, instalable desde el navegador.

**REQ-F-02** (Ubicuo)  
EL SISTEMA DEBERÁ mostrar el progreso del grupo mediante un anillo (donut chart) que refleje el porcentaje acumulado en tiempo real tras cada consulta.

**REQ-F-03** (Event-driven)  
CUANDO un usuario pulsa "Compartir invitación", EL SISTEMA DEBERÁ invocar la **Web Share API** con el nombre del grupo y el enlace que contiene el código de invitación; si la API no está disponible en el navegador, DEBERÁ copiar el enlace al portapapeles como fallback.

**REQ-F-04** (Event-driven)  
CUANDO el usuario otorga permiso de notificaciones, EL SISTEMA DEBERÁ programar un recordatorio local mediante la **Notifications API** para tres días antes de la fecha objetivo del grupo.

**REQ-F-05** (State-driven)  
MIENTRAS hayan transcurrido más de 7 días desde el último aporte registrado en el grupo Y el grupo esté `ACTIVO`, EL SISTEMA DEBERÁ mostrar en la vista de progreso una alerta visual de "sin aportes recientes" y, si el permiso de notificaciones fue concedido, disparar un recordatorio local.

**REQ-F-06** (Event-driven)  
CUANDO el usuario abre la vista de progreso de un grupo Y el navegador soporta la **Prompt API on-device (Gemini Nano)**, EL SISTEMA DEBERÁ generar un resumen motivacional del estado del grupo íntegramente en el navegador, sin enviar datos al servidor.

**REQ-F-07** (Unwanted behavior)  
SI el navegador no soporta la Prompt API on-device, ENTONCES EL SISTEMA DEBERÁ mostrar un mensaje motivacional estático predefinido, sin mostrar errores al usuario.

**REQ-F-08** (Ubicuo)  
EL SISTEMA DEBERÁ ser completamente usable en viewports móviles (mínimo 360 px de ancho) y en escritorio (mínimo 1280 px de ancho), con diseño responsivo.

**REQ-F-09** (Ubicuo)  
EL SISTEMA DEBERÁ cumplir un nivel mínimo de accesibilidad WCAG 2.1 AA en todos los componentes interactivos.
