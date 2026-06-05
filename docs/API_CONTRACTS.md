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
PATCH /leads/:id/status

GET/POST /appointments
PATCH /appointments/:id/status

GET/POST /attendances
GET /attendances/:id
POST /attendances/:id/expenses
GET/POST /income
GET/POST /expenses
GET/POST /evidence
POST /evidence/upload
```
