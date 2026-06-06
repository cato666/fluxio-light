# Integracion Kapso

## Objetivo

Usar Kapso como gateway de WhatsApp sin acoplar Fluxio Light a endpoints o tokens hardcodeados. El modo por defecto es `sandbox`, pensado para probar webhooks, leads, mensajes y evidencias sin conectar un numero real.

## Variables

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

| Variable | Requerida | Uso |
| --- | --- | --- |
| `KAPSO_MODE` | Si | `sandbox` o `production`. Default interno: `sandbox`. |
| `KAPSO_API_BASE_URL` | Si | URL base de Kapso. Se valida como URL y se normaliza sin slash final. |
| `KAPSO_API_KEY` | Para respuestas reales | API key. Si esta vacia o con placeholder, Fluxio simula respuestas salientes. |
| `KAPSO_WEBHOOK_SECRET` | Para firma real | Secreto HMAC para validar `X-Webhook-Signature`. Con placeholder se omite en local. |
| `KAPSO_SANDBOX_PHONE_NUMBER_ID` | Sandbox | Identificador local del numero sandbox. No representa un numero real conectado. |
| `KAPSO_PLATFORM_PHONE_DISPLAY` | Opcional | Numero visible que se muestra al profesional como `Numero Fluxio`. |
| `KAPSO_ASSISTANT_ALLOWED_PHONES` | Opcional | Numeros del profesional autorizados para enviar comandos privados a Fluxio. Separar por coma. |
| `KAPSO_DEFAULT_WORKSPACE_ID` | Opcional | Reservada para cuentas Kapso que requieran workspace scoping. |
| `KAPSO_REQUEST_TIMEOUT_MS` | Opcional | Timeout HTTP para llamadas a Kapso. Default: `10000`. |

## Configuracion en backend

La configuracion queda centralizada en `KapsoConfigService`:

- Valida `KAPSO_MODE` como `sandbox` o `production`.
- Normaliza `KAPSO_API_BASE_URL`.
- Expone `apiKey`, `webhookSecret`, `defaultWorkspaceId`, `sandboxPhoneNumberId`, `isSandbox`, `isApiConfigured` e `isWebhookConfigured`.
- Expone `assistantAllowedPhones` normalizado solo con digitos para detectar comandos privados.
- Considera placeholders como no configurados (`replace...`, `your_...`, `changeme...`).

## Fluxio Assistant / canal privado

El flujo recomendado para profesionales que usan su mismo WhatsApp durante el dia es:

```txt
Cliente <-> numero WhatsApp del profesional
Profesional <-> numero Fluxio/Kapso
Fluxio <-> Kapso API/webhooks
```

Cuando llega un `whatsapp.message.received`, Fluxio compara `message.from` con:

- `KAPSO_ASSISTANT_ALLOWED_PHONES`
- `Professional.assistantAllowedPhones`, configurable desde la vista web `Configuracion`
- `Professional.phone`, si esta configurado en el perfil

Si coincide, el mensaje no se interpreta como cliente. Se procesa como comando privado del profesional y el cliente se resuelve desde el contenido del comando.

La variable de entorno funciona como respaldo global. Para el uso diario, se recomienda administrar los numeros autorizados desde `Configuracion`, separados por coma, espacio o salto de linea.

Comandos soportados inicialmente:

```txt
Registrar atencion: Ana Perez, inyeccion, $30000, transferencia
Cotizar: Ana Perez, inyeccion a domicilio, $30000
Pendientes de cobro
Pago recibido: Ana Perez, $30000, transferencia
Cobrar a Ana Perez
Agendar: Ana Perez, 2026-05-29 10:00, control presion, domicilio
Agenda hoy
Agregar telefono a Ana Perez: +56912345678
Nuevo lead: Carolina, cuidado adulto mayor, Instagram
Registrar gasto: insumos farmacia $8500
Resumen del mes
Menu
```

Reglas:

- Si el cliente existe por nombre o telefono, se reutiliza.
- Si no existe, Fluxio pide confirmacion antes de crear `Contact` con `source=WhatsApp Assistant`.
- Si hay mas de una coincidencia, Fluxio guarda una accion pendiente y responde con una lista numerada.
- La lista de coincidencias incluye telefono, comuna y origen cuando existan. Si falta telefono muestra `sin telefono`.
- La accion pendiente expira despues de 10 minutos y se puede cancelar escribiendo `cancelar` o `no`.
- El numero del profesional autorizado no se crea como cliente.
- Los comandos se envian al chat privado con Fluxio/Kapso, no al chat visible del cliente.

## Onboarding del profesional

La pantalla `Primeros pasos` traduce la configuracion tecnica a lenguaje operativo:

- `Completa tu perfil`
- `Indica tu WhatsApp de trabajo`
- `Guarda el numero Fluxio`
- `Envia tu primer comando`
- `Mensajes base listos`

El profesional ve el numero Fluxio/Kapso al que debe escribir, un boton para copiar `menu` y el estado simple `Listo`, `Esperando tu primer mensaje`, `Necesita revision` o `Aun no configurado`.

Datos como `sandbox/production`, webhook y ultimo error quedan dentro de `Informacion de soporte`, no como pasos principales del onboarding.

Ejemplo de cliente nuevo:

```txt
Profesional:
Registrar atencion: Laura Rojas, inyeccion, $30000, transferencia

Fluxio:
No encontre a "Laura Rojas" en tus clientes.
Lo creo como cliente nuevo para registrar la atencion?

Responde "si" para crear o "no" para cancelar.

Profesional:
si

Fluxio:
Atencion registrada.
Cliente: Laura Rojas
inyeccion
Ingreso: $30.000
```

Ejemplo de nombre ambiguo:

```txt
Profesional:
Registrar atencion: Juan, control presion, $18000, transferencia

Fluxio:
Encontre mas de un cliente posible.
Responde con el numero correcto para registrar la atencion:

1. Juan Soto +56933333333
2. Juan Perez +56988888888

Profesional:
1
```

Ejemplo para completar telefono:

```txt
Profesional:
Agregar telefono a Paola Morales: +56912345678

Fluxio:
Telefono actualizado.
Cliente: Paola Morales
Telefono: +56912345678
```

Ejemplo para agenda:

```txt
Profesional:
Agendar: Juan Soto, manana 10:00, control presion, domicilio

Fluxio:
Cita agendada.
Cliente: Juan Soto
Motivo: control presion
Fecha: 29-05-2026, 10:00
Lugar: domicilio

Profesional:
Agenda manana

Fluxio:
Agenda manana:

10:00 - Juan Soto - control presion - domicilio
```

Ejemplo para cotizar:

```txt
Profesional:
Cotizar: Juan Soto, inyeccion a domicilio, $30000

Fluxio:
Cotizacion lista para Juan Soto:
inyeccion a domicilio
Valor: $30.000

Enviar al cliente?
Responde "si" para enviar o "no" para cancelar.

Profesional:
si

Fluxio:
Cotizacion enviada a Juan Soto.
```

Al preparar la cotizacion, Fluxio crea una `Quote` en estado `PENDING_CONFIRMATION`. Al confirmar, envia la cotizacion al telefono del cliente usando Kapso, guarda el mensaje saliente en `WhatsAppMessage`, actualiza la `Quote` a `SENT` y crea/actualiza un `Lead` con estado `CONTACTED`.

Si el profesional responde `no` o `cancelar`, la `Quote` queda en `CANCELLED`.

El texto enviado al cliente se toma desde la plantilla activa `quote`, editable en `Configuracion`. Variables disponibles:

```txt
{{cliente}} {{servicio}} {{monto}} {{fecha}} {{detalle}}
```

Si la plantilla `quote` esta inactiva, Fluxio usa el texto por defecto del backend.

Desde la interfaz web, la vista `Cotizaciones` permite revisar las cotizaciones, reenviar borradores, marcar `ACCEPTED` o `REJECTED` y convertir una cotizacion aceptada en `Attendance` con `IncomeRecord` asociado. Las atenciones directas siguen permitidas aunque no exista cotizacion previa.

### Documentos PDF salientes

Fluxio usa el endpoint de mensajes de Kapso/WhatsApp con `type: document` y un enlace publico:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+569...",
  "type": "document",
  "document": {
    "link": "https://api.fluxio.cl/uploads/cotizacion.pdf",
    "filename": "cotizacion-cliente-v1.pdf",
    "caption": "Cotizacion lista"
  }
}
```

La vista `Cotizaciones` permite enviar el PDF al cliente o devolverlo al WhatsApp autorizado del profesional. Ambos envios quedan en `WhatsAppMessage` como `type=document`; el documento generado queda en `QuoteDocument`.

Comando privado para devolver el PDF al profesional:

```txt
Cotizar PDF para mi: Ana Perez, curacion a domicilio, $25000
```

`PUBLIC_STORAGE_BASE_URL` debe ser accesible desde Internet para que Kapso descargue el archivo. En local, sin API key real, el envio queda como `SIMULATED`.

Para EasyPanel:

```txt
APP_URL=https://<dominio-publico-backend>
LOCAL_STORAGE_PATH=/app/uploads
PUBLIC_STORAGE_BASE_URL=https://<dominio-publico-backend>/uploads
```

El servicio backend debe tener un volumen persistente con destino `/app/uploads`. La base de datos solo conserva metadatos y la clave del archivo; no conserva el contenido binario del PDF.

Cuando un mensaje entrante normal viene desde el telefono del cliente, Fluxio revisa si existe una cotizacion reciente en `SENT` o `PENDING_CONFIRMATION` para ese contacto. Si detecta aceptacion (`acepto`, `confirmo`, `de acuerdo`, `dale`, `me sirve`) actualiza la `Quote` a `ACCEPTED`. Si detecta rechazo (`no gracias`, `no acepto`, `no me sirve`, `muy caro`, `por ahora no`) actualiza la `Quote` a `REJECTED`.

## Cobros por WhatsApp Assistant

Los ingresos pendientes se gestionan sobre `IncomeRecord` usando `paymentStatus`:

```txt
Pendientes de cobro
Pendientes de cobro de Ana Perez
Pago recibido: Ana Perez, $25000, transferencia
Cobrar a Ana Perez
```

- `Pendientes de cobro` lista ingresos `PENDING` y `PARTIAL`.
- `Pago recibido` actualiza el ingreso pendiente mas antiguo del cliente. Si el monto recibido cubre el total, queda `PAID`; si es menor, queda `PARTIAL`.
- `Cobrar a...` envia al telefono del cliente la plantilla activa `payment_pending`.
- Si el cliente es ambiguo, Fluxio pide escoger una opcion numerada antes de registrar o enviar.

## Modo Sandbox

En `KAPSO_MODE=sandbox`:

1. `POST /api/kapso/setup-link` devuelve un stub local y crea/reutiliza una `WhatsAppConnection` con `connectionType=sandbox`.
2. `POST /api/kapso/webhook` acepta payloads sandbox sin requerir una conexion previa.
3. Si llega un `phone_number_id` desconocido, Fluxio crea una conexion sandbox usando el primer profesional demo disponible.
4. El evento bruto se guarda en `AuditLog`.
5. El mensaje se normaliza y se guarda como `WhatsAppMessage`.
6. Si el telefono del cliente no existe, se crean `Contact` y `Lead`.
7. Si `KAPSO_API_KEY` tiene valor real, Fluxio intenta responder con Kapso. Si no, registra una respuesta simulada.

Payload ejemplo:

```txt
docs/examples/kapso-sandbox-message.json
```

Prueba local:

```bash
cd backend
npm run test:webhook:kapso
npm run test:whatsapp:anti-loop
npm run test:whatsapp:assistant-flow
```

`test:whatsapp:anti-loop` valida que eventos salientes y ecos de respuestas generadas no vuelvan a entrar al parser. `test:whatsapp:assistant-flow` prueba cotizar, cancelar confirmacion, listar cotizaciones y convertir una cotizacion aceptada en atencion usando un telefono temporal de prueba.

O con curl:

```bash
cd backend
curl -X POST http://localhost:3000/api/kapso/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Event: whatsapp.message.received" \
  -H "X-Webhook-Payload-Version: v2" \
  -H "X-Idempotency-Key: sandbox-manual-001" \
  --data-binary "@../docs/examples/kapso-sandbox-message.json"
```

## Webhook Fluxio

```txt
POST /api/kapso/webhook
```

URL publica para Kapso o pruebas externas:

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

La firma se valida con `KAPSO_WEBHOOK_SECRET` usando HMAC-SHA256 hex sobre `JSON.stringify(payload)`. Si `KAPSO_WEBHOOK_SECRET` esta vacio o con placeholder, la validacion se omite para desarrollo local.

Cada webhook recibido se guarda como `AuditLog` con:

- `action`: `KAPSO_WEBHOOK_RECEIVED`
- `entity`: `KapsoWebhook`
- `entityId`: `X-Idempotency-Key`
- `metadata`: headers normalizados, tipo de evento y payload bruto.

Protecciones anti-loop:

- Los eventos `whatsapp.message.sent`, `whatsapp.message.delivered` y `whatsapp.message.read` no se procesan como comandos.
- Los payloads con `kapso.direction=outbound`, estados `sent/delivered/read` o `from_me=true` se ignoran.
- Las respuestas generadas por Fluxio, como listas de cotizaciones o confirmaciones, se detectan antes del parser para evitar bucles de eco en sandbox/coexistence.

La vista web `Eventos` consume `GET /api/audit-logs` y permite revisar cada webhook con resultado de procesamiento, telefono, texto, idempotency key y detalle JSON.

Eventos esperados:

- `whatsapp.message.received`
- `whatsapp.message.sent`
- `whatsapp.message.delivered`
- `whatsapp.conversation.created`
- `whatsapp.conversation.ended`
- `whatsapp.phone_number.created`

## Tunnel local

Con ngrok:

```bash
ngrok http 3000
```

Configura el webhook externo como:

```txt
https://TU_SUBDOMINIO.ngrok-free.app/api/kapso/webhook
```

Con Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Configura:

```txt
https://...trycloudflare.com/api/kapso/webhook
```

## Setup link

Endpoint Fluxio:

```txt
POST /api/kapso/setup-link
```

En sandbox la respuesta es intencionalmente stub:

```json
{
  "url": "http://localhost:3000/mock-kapso-sandbox-setup?professionalId=...&phoneNumberId=fluxio-light-sandbox-phone",
  "mode": "sandbox",
  "status": "connected",
  "setupLinkStatus": "sandbox",
  "connectionId": "uuid",
  "sandboxPhoneNumberId": "fluxio-light-sandbox-phone"
}
```

En production, el adapter queda aislado para crear customer y setup link oficial con Kapso:

```txt
POST /platform/v1/customers
POST /platform/v1/customers/{customer_id}/setup_links
```

No se debe activar `production` hasta confirmar contrato final de Kapso y credenciales reales.

## Media

Los mensajes `image`, `video`, `audio` y `document` se procesan como evidencias. En desarrollo, Fluxio intenta descargar `media_url` a storage local y crea `EvidenceFile` asociado a conversacion, contacto, lead y mensaje.

Prueba local de media:

```bash
cd backend
npm run test:webhook:kapso-media
```
