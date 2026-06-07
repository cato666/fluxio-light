# API Contracts

Base URL:

```txt
/api
```

## Auth

```txt
POST /auth/login
GET /auth/me
```

## Dashboard

```txt
GET /dashboard/summary?month=2026-05
```

## Kapso

```txt
POST /kapso/setup-link
POST /kapso/webhook
POST /kapso/send-message
```

## Administracion WhatsApp

Requiere usuario incluido en `PLATFORM_ADMIN_EMAILS`.

```txt
GET /platform-admin/whatsapp-health
GET /platform-admin/outbound-messages?status=FAILED&take=30
POST /platform-admin/outbound-messages/:id/retry
```

`GET /platform-admin/whatsapp-health` devuelve actividad reciente, configuracion Kapso, conexiones, metricas de las ultimas 24 horas, alertas y mensajes `SENDING` atascados por mas de cinco minutos.

`POST /platform-admin/outbound-messages/:id/retry` solo admite mensajes `text` o `document` fallidos/atascados. Aplica espera minima de 30 segundos, maximo tres intentos por mensaje original y deja trazabilidad en `AuditLog`.

## CRUD principales

```txt
GET/POST /contacts
GET/PATCH/DELETE /contacts/:id

GET/POST /leads
PATCH /leads/:id
PATCH /leads/:id/close
DELETE /leads/:id

GET/POST /appointments
PATCH/DELETE /appointments/:id
POST /appointments/:id/create-attendance

GET/POST /quotes
PATCH/DELETE /quotes/:id
PATCH /quotes/:id/status
POST /quotes/:id/create-attendance
POST /quotes/:id/document
GET /quotes/:id/documents
POST /quotes/:id/send-document

GET/POST /attendances
PATCH/DELETE /attendances/:id
POST /attendances/:id/expenses

GET/POST /income
GET/POST /expenses
GET/POST /evidence
POST /evidence/upload
```

`POST /quotes/:id/send-document` recibe:

```json
{ "recipient": "CLIENT" }
```

o:

```json
{ "recipient": "PROFESSIONAL" }
```
