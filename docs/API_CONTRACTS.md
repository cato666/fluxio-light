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

GET/POST /attendances
PATCH/DELETE /attendances/:id
POST /attendances/:id/expenses

GET/POST /income
GET/POST /expenses
GET/POST /evidence
POST /evidence/upload
```
