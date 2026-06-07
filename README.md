# Fluxio Light

Fluxio Light es un MVP separado de Fluxio principal para profesionales independientes que desean operar desde WhatsApp: leads, agenda, atenciones, ingresos, gastos, evidencias y reportes mensuales.

## Stack

- Backend: NestJS + Prisma + PostgreSQL
- Frontend: React + Vite + Tailwind CSS
- WhatsApp: Kapso como gateway
- Storage: local en MVP, preparado para S3/MinIO
- Deploy: Docker / EasyPanel

## Experiencia de uso

La interfaz del profesional prioriza la operacion diaria:

- navegacion principal reducida a Dashboard, Clientes, Agenda, Atenciones y WhatsApp;
- modulos secundarios agrupados bajo `Mas`;
- dashboard `Hoy` con agenda, conversaciones por responder, cotizaciones pendientes y cobros pendientes;
- menu global `Nueva accion` para acceder rapidamente a clientes, agenda, atenciones, cotizaciones y WhatsApp;
- ciclo operativo web completo: reprogramar o cancelar agenda, convertir una cita en atencion e ingreso, cerrar leads con motivo, editar o cancelar cotizaciones y actualizar atenciones/pagos;
- eliminacion protegida: cotizaciones enviadas y atenciones con gastos o evidencias conservan su trazabilidad y deben cancelarse en lugar de borrarse;
- validacion UX transversal: errores legibles de API, timeout de red, bloqueo de doble envio, validacion de formularios, estados de carga y mensajes de exito/error accesibles;
- busqueda, filtro Demo/Reales, contador y paginacion en clientes, agenda, leads, cotizaciones, atenciones, ingresos y gastos;
- tablas operativas con desplazamiento horizontal controlado para pantallas moviles;
- estados de negocio mostrados con etiquetas legibles en español, manteniendo los enums internos en backend.

## Estructura

```txt
fluxio-light/
|-- backend/
|-- frontend/
|-- docs/
|-- docker-compose.yml
`-- .env.example
```

## Checklist pre-release

Antes de subir una primera version publica o piloto:

- No subir `.env`, `backend/.env`, `frontend/.env`, logs de tunel ni archivos de `uploads`.
- Cambiar `JWT_SECRET` por un valor fuerte y unico.
- Configurar `FRONTEND_URL` con el dominio real; en produccion no debe quedar `*`.
- Usar credenciales reales de Postgres; `fluxio/fluxio` es solo local.
- Definir `PLATFORM_ADMIN_EMAILS` solo con correos internos.
- Revisar `KAPSO_API_KEY` y `KAPSO_WEBHOOK_SECRET`; nunca deben quedar hardcodeados en codigo o docs.
- Usar el seed solo en entornos locales/demo. El seed recrea datos del usuario demo.
- Ejecutar `npm audit --omit=dev`, builds, migraciones y una prueba de webhook sandbox antes de invitar pilotos.

## Ejecutar local

```bash
cp .env.example .env
docker compose up -d postgres
cd backend
cp ../.env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

En otra terminal:

```bash
cd frontend
cp ../.env.example .env
npm install
npm run dev
```

Con Docker Compose, el backend ya no ejecuta seed destructivo en cada reinicio. Para levantar sin borrar datos:

```bash
docker compose up -d --build backend frontend
```

Para resetear datos demo manualmente:

```bash
docker compose --profile seed run --rm seed
```

## Usuario demo

```txt
Email: admin@fluxiolight.local
Password: admin123
```

## Registro y aprobacion de cuentas

La pantalla de login permite enviar una solicitud en `Crear cuenta`. Por ahora, las cuentas nuevas quedan en estado `PENDING_APPROVAL` y no pueden iniciar sesion hasta que Fluxio las habilite manualmente.

Flujo:

1. El profesional crea la cuenta desde la web.
2. Fluxio revisa la solicitud.
3. Un operador interno habilita la cuenta desde `Admin plataforma`.
4. El profesional inicia sesion y entra a `Primeros pasos`.

Comandos internos de respaldo:

```bash
cd backend
npm run admin:approve-user -- profesional@mail.com
npm run admin:suspend-user -- profesional@mail.com
```

El usuario demo queda activo automaticamente por seed/migracion.

## Panel Admin de plataforma

El panel `Admin plataforma` es para operar Fluxio como SaaS completo. No es un rol de los profesionales ni un panel administrativo dentro de una cuenta de cliente.

Habilita los correos internos con:

```env
PLATFORM_ADMIN_EMAILS=admin@fluxiolight.local
```

Las cuentas listadas ahi pueden entrar con su usuario normal y ver una seccion adicional en la barra lateral. El panel permite:

- ver profesionales registrados, pendientes, activos y suspendidos;
- revisar una bandeja de `Pendientes de aprobacion` con contexto de invitacion;
- aprobar, devolver a pendiente o suspender cuentas;
- revisar telefono principal y telefonos autorizados para Fluxio Assistant;
- ver actividad reciente, uso por profesional y estado de conexion WhatsApp/Kapso;
- validar conflictos multi-profesional, por ejemplo si dos profesionales tienen el mismo telefono autorizado.
- abrir el detalle de un profesional para soporte;
- editar telefonos autorizados desde el detalle;
- bloquear la aprobacion de una cuenta cuando sus telefonos autorizados chocan con otro profesional.
- revisar el checklist de activacion demo por profesional.
- preparar datos demo por profesional con cliente, lead, cotizacion, agenda, atencion, ingreso, gasto y conversacion de ejemplo.
- restablecer el demo de un profesional borrando solo datos `Fluxio Demo` y recreando el caso base.
- ver el estado derivado `Listo para demo` / `Requiere accion` y ejecutar acciones desde cada paso del checklist.
- revisar una ficha de aprobacion con origen de registro, nota de invitacion, telefonos, checklist y acciones principales.
- copiar un mensaje de bienvenida post-aprobacion para enviar manualmente por WhatsApp o email.
- guardar notas internas por profesional para soporte y seguimiento comercial.
- revisar auditoria categorizada por `Cuenta`, `Invitacion`, `WhatsApp`, `Demo` o `Sistema`.
- seguir un checklist de salida a piloto con etapas de invitacion, registro, aprobacion, demo, prueba WhatsApp y cliente creado.

Los profesionales normales no ven esta seccion. La separacion de datos sigue usando `professionalId`; el panel admin solo expone una vista global para operadores de Fluxio.

La resolucion de conflictos se hace editando el telefono principal o `Telefonos autorizados` del profesional afectado. Si dos cuentas pendientes comparten telefono, Fluxio permite corregirlas desde Admin; si se intenta aprobar una cuenta con conflicto, la aprobacion falla hasta dejar el telefono asignado a un unico profesional.

### Preparar demo por profesional

Desde `Admin plataforma` > detalle de profesional, el operador puede usar `Preparar demo` para poblar un caso comercial de ejemplo. La accion es idempotente: reutiliza/actualiza el set marcado como `Fluxio Demo` para evitar duplicados accidentales.

El estado `Listo para demo` se deriva del checklist de activacion. Mientras falten pasos, el detalle muestra botones accionables para aprobar la cuenta, configurar telefonos, preparar datos demo o indicar la prueba de WhatsApp que debe realizar el profesional.

Si una demo queda desordenada durante pruebas, `Restablecer demo` borra solo el set marcado como `Fluxio Demo` del profesional y vuelve a crear el caso base. La accion registra auditoria `PLATFORM_ADMIN_RESET_DEMO_DATA` antes de recrear los datos.

El profesional puede entrar a `Modo demo` para ver el caso Ana Perez, copiar comandos de WhatsApp y navegar directo a clientes, cotizaciones, atenciones y conversacion demo.

Desde el detalle Admin, `Validar demo` ejecuta un health check comercial: cuenta activa, perfil, telefono autorizado, numero Fluxio/Kapso, plantillas, datos demo, inbound, outbound y errores salientes.

Desde el mismo detalle, `Validar piloto real` revisa si el profesional esta listo para trabajar con un primer piloto real: cuenta activa, telefono autorizado, cliente real, lead/cotizacion real, atencion o ingreso real, conversacion WhatsApp real, outbound sin fallos y separacion demo/real. El resultado puede ser `READY_FOR_REAL_PILOT` o `NEEDS_REAL_ACTIVITY`.

Las vistas operativas separan datos demo y reales con badge `Demo` y filtro `Todos / Reales / Demo` en clientes, leads, cotizaciones, agenda, atenciones, ingresos, gastos, evidencias y WhatsApp. En Cliente 360 se muestra una banda cuando el cliente pertenece al modo demo. En Admin, el detalle del profesional muestra conteos reales vs demo para soporte comercial.

`Primeros pasos` incluye un flujo de primer cliente real. El profesional ve un checklist separado de la demo para crear cliente real, preparar cotizacion real, registrar atencion real, registrar pago/pendiente y tener una conversacion real. Desde esa misma vista puede crear un cliente real inicial y navegar a clientes, cotizaciones, WhatsApp o cobros reales.

### Invitaciones de profesionales

El panel `Admin plataforma` permite crear invitaciones para altas controladas de profesionales. El MVP no envia email automaticamente: crea un mensaje listo para copiar por WhatsApp/email, incluye el link de registro y deja trazabilidad.

Flujo:

1. Admin crea invitacion con nombre, email, profesion, telefono y nota interna.
2. Fluxio genera un link `FRONTEND_URL/?invite=<token>` y un texto de invitacion.
3. Admin copia el mensaje y lo envia manualmente por WhatsApp o email.
4. El profesional se registra desde el link.
5. La cuenta queda `PENDING_APPROVAL`.
6. Admin revisa la bandeja `Pendientes de aprobacion`.
7. Admin aprueba o suspende manualmente la cuenta cuando corresponda.

Estados de invitacion: `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED`.

Cada cambio de estado de cuenta desde Admin queda auditado como `PLATFORM_ADMIN_UPDATED_ACCOUNT_STATUS`.

Cuando la cuenta queda activa, el detalle Admin muestra un mensaje de bienvenida copiable para orientar al profesional hacia `Primeros pasos` y la prueba del comando `menu` contra el numero Fluxio/Kapso configurado.

El detalle Admin tambien incluye notas internas. Estas notas son visibles solo para operadores de plataforma y cada cambio queda auditado como `PLATFORM_ADMIN_UPDATED_PROFESSIONAL_NOTES`.

### Guia corta para profesionales

La vista `Primeros pasos` incluye una guia rapida de comandos WhatsApp para que el profesional pueda operar principalmente desde su telefono:

```text
menu
Registrar atencion: Juan Perez, curacion, $30000, transferencia
Cotizar: Ana Perez, curacion a domicilio, $25000
Agendar: Ana Perez, curacion, manana 10:00
Pago: Ana Perez, $25000, transferencia
Pendientes de cobro
```

El objetivo de la guia es servir como material de apoyo para pilotos iniciales sin exponer documentacion tecnica.

Ejemplo de mensaje generado:

```text
Hola Ana, te invitamos a activar tu cuenta en Fluxio.

Con este link puedes crear tu usuario y solicitar la habilitacion:
http://localhost:5173/?invite=<token>

Cuando completes el registro, revisaremos la cuenta y te avisaremos para comenzar con la configuracion inicial.
```

El demo crea:

- cliente `Ana Perez`;
- lead y cotizacion aceptada por una curacion simple;
- agenda para el dia siguiente;
- atencion completada con ingreso por transferencia y gasto de insumos;
- conversacion WhatsApp con mensajes entrantes/salientes de ejemplo;
- auditoria `PLATFORM_ADMIN_PREPARED_DEMO_DATA`.

### Reasignacion controlada por telefono

El panel Admin incluye una herramienta de soporte para corregir datos creados bajo el profesional equivocado durante pruebas o problemas de ruteo.

Flujo:

1. Buscar por telefono normalizado, por ejemplo `56921134579`.
2. Revisar la vista previa: profesionales afectados, contactos, conversaciones, mensajes y datos relacionados.
3. Elegir el profesional destino.
4. Seleccionar si se moveran datos WhatsApp, contactos/datos relacionados, o ambos.
5. Confirmar la operacion.

La reasignacion puede mover:

- conversaciones WhatsApp, mensajes y evidencias asociadas;
- contactos encontrados por telefono;
- leads, cotizaciones, agenda, atenciones, ingresos, gastos y evidencias vinculadas a esos contactos.

Cada ejecucion queda registrada en `AuditLog` con la accion `PLATFORM_ADMIN_REASSIGNED_DATA_BY_PHONE`.

## Variables Kapso

```env
KAPSO_MODE=sandbox
KAPSO_API_BASE_URL=https://api.kapso.ai
KAPSO_API_KEY=replace_with_kapso_api_key
KAPSO_WEBHOOK_SECRET=replace_with_webhook_secret
KAPSO_SANDBOX_PHONE_NUMBER_ID=fluxio-light-sandbox-phone
KAPSO_PLATFORM_PHONE_DISPLAY=
KAPSO_ASSISTANT_ALLOWED_PHONES=
KAPSO_DEFAULT_WORKSPACE_ID=
KAPSO_REQUEST_TIMEOUT_MS=10000
```

- `KAPSO_MODE`: `sandbox` para desarrollo sin numero real; `production` para usar endpoints reales cuando Kapso este confirmado.
- `KAPSO_API_BASE_URL`: URL base de la API Kapso. Debe ser una URL valida.
- `KAPSO_API_KEY`: credencial para llamadas reales a Kapso. Si queda con placeholder, Fluxio no llama endpoints reales y simula respuestas.
- `KAPSO_WEBHOOK_SECRET`: secreto para validar webhooks. Si queda con placeholder, la validacion se omite para desarrollo local.
- `KAPSO_SANDBOX_PHONE_NUMBER_ID`: identificador local para enrutar webhooks sandbox sin conectar un numero real.
- `KAPSO_PLATFORM_PHONE_DISPLAY`: numero visible de Fluxio/Kapso que vera el profesional en onboarding. Ejemplo: `+56920403095`.
- `KAPSO_ASSISTANT_ALLOWED_PHONES`: telefonos del profesional autorizados para usar el chat privado con Fluxio, separados por coma y sin requerir `+`. Ejemplo: `56994375379`.
- `KAPSO_DEFAULT_WORKSPACE_ID`: workspace por defecto si la cuenta Kapso lo requiere. Opcional.
- `KAPSO_REQUEST_TIMEOUT_MS`: timeout para llamadas HTTP hacia Kapso.

## Configuracion desde la web

La vista `Primeros pasos` guia al profesional sin conceptos tecnicos:

- completar perfil;
- indicar su WhatsApp de trabajo para comandos;
- ver el numero Fluxio/Kapso al que debe escribir;
- copiar el comando `menu` para probar;
- preparar mensajes base.

La activacion demo se muestra como checklist:

- cuenta aprobada;
- perfil completo;
- WhatsApp autorizado para comandos;
- numero Fluxio disponible;
- primer comando recibido;
- primera respuesta saliente registrada;
- plantillas base listas.

El profesional ve el siguiente paso pendiente y el operador lo puede revisar desde `Admin plataforma`.

La vista `Configuracion` permite editar datos del profesional y plantillas sin tocar archivos locales:

- nombre visible, profesion, telefono principal, email, zona horaria y moneda;
- telefonos autorizados para usar Fluxio Assistant;
- plantillas de mensajes salientes.

Los telefonos autorizados tambien pueden venir desde `KAPSO_ASSISTANT_ALLOWED_PHONES`. La configuracion del profesional se suma a esa variable, por lo que puedes usar `.env` como respaldo y administrar numeros adicionales desde la interfaz.

## Plantillas de mensajes

Fluxio crea plantillas base para:

- `quote`: cotizacion enviada al cliente;
- `attendance_confirmation`: confirmacion de atencion;
- `appointment_reminder`: recordatorio;
- `payment_pending`: aviso de pago pendiente.

Variables soportadas:

```txt
{{cliente}} {{servicio}} {{monto}} {{fecha}} {{detalle}}
```

Las plantillas `quote` y `payment_pending` ya se usan al enviar cotizaciones y cobros desde Fluxio Assistant. Si una plantilla esta inactiva, Fluxio usa el mensaje interno por defecto.

## Fluxio Assistant por WhatsApp

Para que el profesional no tenga que entrar a la web durante el dia, Fluxio puede funcionar como un chat privado de comandos.

Flujo recomendado:

1. El profesional conversa con clientes desde su WhatsApp normal.
2. El profesional escribe al numero Fluxio/Kapso, no al cliente.
3. Si el remitente esta en `KAPSO_ASSISTANT_ALLOWED_PHONES`, Fluxio trata el mensaje como comando privado.
4. El cliente se busca por nombre o telefono dentro del comando.

Ejemplos:

```txt
Registrar atencion: Ana Perez, inyeccion, $30000, transferencia
Cotizar: Ana Perez, inyeccion a domicilio, $30000
Cotizar PDF para mi: Ana Perez, inyeccion a domicilio, $30000
Pendientes de cobro
Pago recibido: Ana Perez, $25000, transferencia
Cobrar a Ana Perez
Nuevo lead: Carolina, cuidado adulto mayor, Instagram
Registrar gasto: insumos farmacia $8500
Resumen del mes
```

En este modo el numero del profesional no se crea como cliente. Si Fluxio encuentra varios contactos con el mismo nombre, responde con una lista numerada para resolver la ambiguedad.

### Menu guiado de WhatsApp

El profesional puede escribir `menu` y responder solamente con numeros:

```txt
1. Registrar atencion
2. Crear cotizacion
3. Agendar servicio
4. Registrar gasto
5. Mas opciones
```

Cada opcion solicita un dato por mensaje y muestra una confirmacion antes de guardar o enviar. En cotizaciones se puede escoger texto al cliente, PDF al cliente, PDF al profesional o borrador. `cancelar` termina el flujo en cualquier paso.

Los comandos completos anteriores siguen disponibles como atajos.

En onboarding, esto se muestra como `Numero Fluxio` y `WhatsApp de trabajo para comandos`. El profesional no necesita ver `sandbox`, `production` ni `webhook URL`; esos datos quedan para soporte.

Las cotizaciones quedan guardadas como entidad propia. Una atencion puede existir sin cotizacion previa; cuando una cotizacion se acepta, se puede convertir en atencion desde la vista `Cotizaciones`, creando tambien el ingreso asociado.

Cada cotizacion puede generar un PDF versionado con datos del profesional, cliente, servicio, monto, vigencia, condiciones de pago y observaciones. Desde la web existen tres acciones:

- generar y descargar el PDF;
- enviarlo directamente al telefono del cliente;
- enviarlo al WhatsApp autorizado del profesional para que lo revise y reenvie manualmente.

Desde Fluxio Assistant, el profesional puede pedir el documento en el mismo chat privado:

```txt
Cotizar PDF para mi: Ana Perez, inyeccion a domicilio, $30000
```

Este comando nunca envia el documento al cliente. Crea la cotizacion y devuelve el PDF al telefono que envio el comando.

Si el cliente responde a una cotizacion con mensajes como `acepto`, `confirmo`, `de acuerdo`, `dale` o `me sirve`, Fluxio la marca como aceptada. Si responde `no gracias`, `no acepto`, `no me sirve`, `muy caro` o `por ahora no`, la marca como rechazada.

Comandos de cotizaciones disponibles en Fluxio Assistant:

```txt
Cotizaciones pendientes
Cotizaciones aceptadas
Cotizaciones rechazadas
Cotizaciones de Ana Perez
Crear atencion desde cotizacion de Ana Perez
```

Al convertir una cotizacion aceptada desde WhatsApp, Fluxio crea la atencion, crea el ingreso pendiente asociado, marca la cotizacion como `CONVERTED` y marca el lead como `WON` si corresponde.

Comandos de cobro disponibles en Fluxio Assistant:

```txt
Pendientes de cobro
Pendientes de cobro de Ana Perez
Pago recibido: Ana Perez, $25000, transferencia
Cobrar a Ana Perez
```

`Pago recibido` marca el ingreso pendiente mas antiguo del cliente como `PAID` si el monto cubre el total, o `PARTIAL` si el monto es menor. `Cobrar a...` envia al cliente la plantilla activa `payment_pending`.

## Detalle 360 del cliente

La vista `Clientes` permite abrir `Ver detalle` para revisar la historia completa de un contacto:

- datos de contacto y notas;
- leads, cotizaciones, agenda y atenciones;
- ingresos, pendientes de cobro, gastos y utilidad estimada;
- evidencias asociadas;
- conversaciones y ultimos mensajes de WhatsApp.

## Eventos y auditoria

La vista `Eventos` muestra los ultimos webhooks Kapso y el resultado del procesamiento:

- evento recibido;
- telefono y texto;
- resultado (`Procesado`, comando detectado, `generated_reply_echo`, `outbound_or_status_event`, duplicado, etc.);
- idempotency key;
- detalle JSON resumido.

Esto permite diagnosticar si Kapso envio el webhook, si Fluxio lo proceso, o si fue ignorado por una proteccion anti-loop.

## Trazabilidad de mensajes salientes

Cada mensaje que Fluxio intenta enviar por Kapso queda registrado como `WhatsAppMessage` con direccion `OUTBOUND`.

Estados soportados:

```txt
SENDING
SENT
SIMULATED
FAILED
DELIVERED
READ
```

Campos principales:

- `outboundSource`: flujo que origino el envio, por ejemplo `manual_reply`, `quote`, `assistant_quote`, `quote_pdf_client`, `quote_pdf_professional` o `assistant_payment_reminder`;
- `outboundStatus`: estado operacional del envio;
- `outboundError`: error devuelto por Kapso si el envio falla;
- `kapsoMessageId`: id devuelto por Kapso cuando existe;
- `sentAt`, `deliveredAt`, `readAt`, `failedAt`.

Los estados `DELIVERED` y `READ` se actualizan desde webhooks outbound/status de Kapso cuando el payload incluye el `kapsoMessageId`.

Para documentos salientes, `PUBLIC_STORAGE_BASE_URL` debe apuntar a la URL publica del backend, por ejemplo:

```txt
PUBLIC_STORAGE_BASE_URL=https://api.fluxio.cl/uploads
```

Kapso debe poder descargar esa URL. `http://localhost:3000/uploads` solo sirve para desarrollo local o envios simulados.

En EasyPanel, para el backend configura:

```txt
APP_URL=https://laboratorio-api-fluxio.sgnetm.easypanel.host
LOCAL_STORAGE_PATH=/app/uploads
PUBLIC_STORAGE_BASE_URL=https://laboratorio-api-fluxio.sgnetm.easypanel.host/uploads
```

Ademas, crea un volumen persistente montado en:

```txt
/app/uploads
```

Sin ese volumen, los PDF locales se pierden cuando EasyPanel reconstruye o reemplaza el contenedor. Despues de corregir estas variables, vuelve a generar el PDF desde `Cotizaciones > PDF > Generar y descargar`; los documentos nuevos ya guardaran la URL publica correcta.

Visibilidad:

- En `WhatsApp`, las burbujas salientes muestran el estado y el error si falla.
- En `Admin plataforma`, la tabla `Mensajes salientes Kapso` muestra los ultimos intentos globales y ayuda a diagnosticar problemas de API key, configuracion o numero conectado.

## Kapso Sandbox local

En `KAPSO_MODE=sandbox`, `POST /api/kapso/setup-link` devuelve un stub local y crea/reutiliza una `WhatsAppConnection` sandbox. No conecta numeros reales ni crea setup links reales.

Para probar webhooks sin numero real:

```bash
cd backend
npm run test:webhook:kapso
npm run test:webhook:kapso-media
npm run test:whatsapp:anti-loop
npm run test:whatsapp:assistant-flow
```

Tambien puedes enviar el payload sandbox versionado:

```bash
cd backend
curl -X POST http://localhost:3000/api/kapso/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Event: whatsapp.message.received" \
  -H "X-Webhook-Payload-Version: v2" \
  -H "X-Idempotency-Key: sandbox-manual-001" \
  --data-binary "@../docs/examples/kapso-sandbox-message.json"
```

El webhook guarda el payload bruto en `AuditLog`, normaliza el mensaje a `WhatsAppMessage`, crea `WhatsAppConversation` y, si el telefono no existe, crea `Contact` y `Lead`. Si `KAPSO_API_KEY` tiene un valor real, Fluxio intenta responder usando Kapso; con placeholder, registra una respuesta simulada.

Para exponer el webhook local con ngrok:

```bash
ngrok http 3000
```

Usa la URL generada como `https://TU_SUBDOMINIO.ngrok-free.app/api/kapso/webhook`.

Alternativa con Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Usa la URL `https://...trycloudflare.com/api/kapso/webhook`.

## Webhook Kapso

Configura el webhook en Kapso apuntando a:

```txt
POST https://TU_DOMINIO/api/kapso/webhook
```

Headers soportados:

```txt
X-Webhook-Event: whatsapp.message.received
X-Webhook-Signature: <hmac-sha256-hex>
X-Idempotency-Key: <unique-id>
X-Webhook-Payload-Version: v2
Content-Type: application/json
```

Eventos sugeridos:

- `whatsapp.message.received`
- `whatsapp.message.sent`
- `whatsapp.message.delivered`
- `whatsapp.conversation.created`
- `whatsapp.conversation.ended`
- `whatsapp.phone_number.created`

## Setup link

En `KAPSO_MODE=sandbox`, el setup link se mantiene como stub local. En `KAPSO_MODE=production`, el adapter queda aislado para solicitar setup links reales a Kapso usando variables de entorno, sin hardcodear tokens.

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/kapso/setup-link \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Objetivo del MVP

1. Registrar profesionales independientes.
2. Conectar WhatsApp usando Kapso setup links cuando corresponda.
3. Convertir mensajes entrantes en leads.
4. Enviar cotizaciones por WhatsApp y convertir cotizaciones o leads aceptados en atenciones.
5. Guardar imagenes, documentos y evidencias.
6. Mostrar dashboard mensual en web.
